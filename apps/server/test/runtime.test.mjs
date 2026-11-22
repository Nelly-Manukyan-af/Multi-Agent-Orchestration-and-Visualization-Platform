import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { WebSocket } from "ws";
import { createTestDatabase } from "./support/database.mjs";
import { reduceEvents } from "../../../packages/shared/src/index.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const preload = fileURLToPath(new URL("./support/scripted-model.mjs", import.meta.url));

async function until(check, label, milliseconds = 6000) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await delay(10);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function startServer(url, scenario) {
  const child = spawn(process.execPath, ["--import", preload, "apps/server/src/index.ts"], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: url,
      PORT: "0",
      STATIC_DIR: "",
      MODEL_PROVIDER: "ollama",
      MODEL: "scripted",
      OLLAMA_MODEL: "scripted",
      OLLAMA_URL: "http://scripted-model.test",
      GEMINI_API_KEY: "",
      SCRIPTED_MODEL_SCENARIO: scenario,
      SHUTDOWN_TIMEOUT_MS: scenario === "hung" ? "300" : "3000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "", stderr = "", exit;
  child.stdout.on("data", data => { stdout += data; });
  child.stderr.on("data", data => { stderr += data; });
  child.on("exit", (code, signal) => { exit = { code, signal }; });
  child.on("error", error => { stderr += error.message; });
  const sockets = new Set();
  const server = {
    child,
    get stdout() { return stdout; },
    get stderr() { return stderr; },
    async waitForExit() {
      return until(() => exit, `server exit (${stderr})`);
    },
    async close() {
      for (const socket of sockets) socket.terminate();
      if (!exit) {
        child.kill("SIGTERM");
        try { await server.waitForExit(); }
        catch { child.kill("SIGKILL"); await server.waitForExit(); }
      }
    },
  };
  try {
    const match = await until(() => {
      if (exit) throw new Error(`Server exited before startup: ${stderr}`);
      return stdout.match(/Server listening on http:\/\/localhost:(\d+)/);
    }, "server startup");
    const base = `http://127.0.0.1:${match[1]}`;
    server.request = async (path, body) => {
      const response = await fetch(base + path, {
        ...(body !== undefined ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(4000),
      });
      assert(response.ok, `${path} returned ${response.status}: ${await response.clone().text()}`);
      return response.json();
    };
    server.start = async (settings = {}) => (await server.request("/runs", { task: "Test debate", rounds: 1, turnLimit: 3, ...settings })).runId;
    server.events = runId => server.request(`/runs/${runId}/events`);
    server.finished = runId => until(async () => {
      const events = await server.events(runId);
      return events.at(-1)?.type === "run_finished" ? events : false;
    }, "run finalization");
    server.subscribe = async (runId, afterSeq = 0) => {
      const socket = new WebSocket(base.replace("http:", "ws:") + "/ws");
      sockets.add(socket);
      const events = [];
      let error;
      socket.on("error", e => { error = e; });
      socket.on("message", raw => {
        const message = JSON.parse(raw.toString());
        if (message.type === "event") events.push(message.event);
        else error = new Error(message.message);
      });
      await once(socket, "open");
      socket.send(JSON.stringify({ type: "subscribe", runId, afterSeq }));
      return {
        events,
        socket,
        async until(type) {
          return until(() => {
            if (error) throw error;
            return events.find(event => event.type === type);
          }, `WebSocket ${type}`);
        },
      };
    };
    return server;
  } catch (error) {
    await server.close();
    throw error;
  }
}

function runtimeTest(name, scenario, check) {
  test(name, { timeout: 20000 }, async () => {
    const fixture = await createTestDatabase();
    const pool = new Pool({ connectionString: fixture.url });
    const servers = [];
    const start = async (mode = scenario) => {
      const server = await startServer(fixture.url, mode);
      servers.push(server);
      return server;
    };
    try {
      const server = await start();
      await check(server, pool, start);
    } finally {
      for (const server of servers) await server.close();
      await pool.end();
      await fixture.close();
    }
  });
}

function assertFinal(events, status) {
  assert.deepEqual(events.map(event => event.seq), events.map((_, i) => i + 1));
  assert.equal(events[0].type, "run_started");
  assert.equal(events.filter(event => event.type === "run_finished").length, 1);
  assert.equal(events.at(-1).type, "run_finished");
  assert.equal(events.at(-1).status, status);
  const started = events.filter(event => event.type === "turn_started");
  const finished = events.filter(event => event.type === "turn_finished");
  assert.deepEqual(finished.map(event => event.turnId), started.map(event => event.turnId));
  assert.equal(reduceEvents(events).status, status);
}

runtimeTest("normal completion persists expected messages, usage, and event order", "success", async server => {
  const id = await server.start();
  const events = await server.finished(id);
  assertFinal(events, "completed");
  assert.deepEqual(events.map(event => event.type), ["run_started", ...Array.from({ length: 3 }, () => [
    "turn_started", "model_request", "llm_token", "llm_token", "agent_message", "turn_finished",
  ]).flat(), "run_finished"]);
  assert.deepEqual(events.filter(e => e.type === "agent_message").map(e => [e.from, e.text]), [
    ["pro", "Reply 1"], ["con", "Reply 2"], ["judge", "Reply 3"],
  ]);
  assert.equal(events.at(-1).totals.promptTokens, 21);
  assert.equal(events.at(-1).totals.completionTokens, 33);
  assert.equal((await server.request(`/runs/${id}`)).totalTokens, 54);
});

runtimeTest("temporary provider failure retries once and completes", "retry", async server => {
  const events = await server.finished(await server.start());
  assertFinal(events, "completed");
  assert.deepEqual(events.filter(e => e.type === "turn_retried").map(e => [e.reason, e.attempt]), [["connection", 2]]);
  assert.equal(events.filter(e => e.type === "model_request").length, 4);
  assert.equal(events.find(e => e.type === "agent_message").text, "Reply 2");
});

runtimeTest("empty reply retries with a correction message", "empty", async server => {
  const events = await server.finished(await server.start());
  assertFinal(events, "completed");
  assert.deepEqual(events.filter(e => e.type === "turn_retried").map(e => e.reason), ["empty"]);
  const requests = events.filter(e => e.type === "model_request");
  assert.equal(requests[1].messages.at(-1).content, "Your previous reply was empty. Please answer now.");
});

runtimeTest("persistent provider failure stops after one retry", "failure", async server => {
  const events = await server.finished(await server.start());
  assertFinal(events, "failed");
  assert.equal(events.filter(e => e.type === "model_request").length, 2);
  assert.equal(events.filter(e => e.type === "agent_message").length, 0);
  assert.equal(events.at(-2).status, "error");
});

runtimeTest("repeated messages stop the debate as a loop", "loop", async server => {
  const events = await server.finished(await server.start({ rounds: 3, turnLimit: 7 }));
  assertFinal(events, "loop_detected");
  assert.deepEqual(events.filter(e => e.type === "turn_started").map(e => e.agentId), ["pro", "con", "pro"]);
});

runtimeTest("Stop preserves streamed partial output without delivering a message", "stream", async server => {
  const id = await server.start();
  const live = await server.subscribe(id);
  await live.until("llm_token");
  await server.request(`/runs/${id}/stop`, {});
  const events = await server.finished(id);
  assertFinal(events, "stopped");
  assert.equal(events.at(-1).reason, "Stopped by user");
  assert.equal(events.at(-2).status, "aborted");
  assert.equal(events.at(-2).rawOutput, "Partial response");
  assert.equal(events.filter(e => e.type === "agent_message").length, 0);
  await live.until("run_finished");
  assert.deepEqual(live.events, events);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  runtimeTest(`${signal} flushes partials and delivers exactly one final event`, "stream", async (server, pool) => {
    const id = await server.start();
    const live = await server.subscribe(id);
    await live.until("llm_token");
    server.child.kill(signal);
    assert.deepEqual(await server.waitForExit(), { code: 0, signal: null });
    const events = (await pool.query("SELECT payload FROM events WHERE run_id=$1 ORDER BY seq", [id])).rows.map(row => row.payload);
    assertFinal(events, "stopped");
    assert.equal(events.at(-1).reason, "Server shutting down");
    assert.equal(events.at(-2).rawOutput, "Partial response");
    await live.until("run_finished");
    assert.deepEqual(live.events, events);
    assert.equal((await pool.query("SELECT status FROM runs WHERE id=$1", [id])).rows[0].status, "stopped");
  });
}

runtimeTest("shutdown deadline bounds an unresponsive model request", "hung", async server => {
  await server.start();
  await until(() => server.stdout.includes("Scripted model request 1"), "hung request to start");
  server.child.kill("SIGTERM");
  assert.deepEqual(await server.waitForExit(), { code: 1, signal: null });
  assert.match(server.stderr, /shutdown timed out/i);
});

runtimeTest("restart closes an orphaned run and preserves its partial output", "stream", async (server, pool, restart) => {
  const id = await server.start();
  const live = await server.subscribe(id);
  await live.until("llm_token");
  server.child.kill("SIGKILL");
  assert.equal((await server.waitForExit()).signal, "SIGKILL");
  const replacement = await restart("success");
  const events = await replacement.events(id);
  assertFinal(events, "stopped");
  assert.equal(events.at(-1).reason, "Server restarted");
  assert.equal(events.at(-2).status, "aborted");
  assert.equal(events.at(-2).rawOutput, "Partial response");
  assert.equal((await pool.query("SELECT status FROM runs WHERE id=$1", [id])).rows[0].status, "stopped");
});

runtimeTest("storage failure aborts execution without publishing uncommitted tokens", "stream", async (server, pool, restart) => {
  await pool.query(`CREATE FUNCTION fail_tokens() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.type = 'llm_token' THEN RAISE EXCEPTION 'scripted storage failure'; END IF; RETURN NEW; END $$`);
  await pool.query("CREATE TRIGGER fail_tokens BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION fail_tokens()");
  const id = await server.start();
  const live = await server.subscribe(id);
  await until(() => server.stderr.includes("could not be finalized"), "storage failure to abort execution");
  assert.deepEqual((await pool.query("SELECT type FROM events WHERE run_id=$1 ORDER BY seq", [id])).rows.map(e => e.type), [
    "run_started", "turn_started", "model_request",
  ]);
  assert(!live.events.some(e => e.type === "llm_token" || e.type === "run_finished"));
  assert.equal(server.stdout.match(/Scripted model request/g)?.length, 1);
  await pool.query("DROP TRIGGER fail_tokens ON events");
  await server.close();
  assert.deepEqual(await server.waitForExit(), { code: 0, signal: null });
  const replacement = await restart("success");
  const events = await replacement.events(id);
  assertFinal(events, "stopped");
  assert.equal(events.at(-1).reason, "Server restarted");
  assert.equal(events.at(-2).rawOutput, "Partial response");
});
