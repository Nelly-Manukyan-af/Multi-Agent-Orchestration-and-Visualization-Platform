import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createTestDatabase } from "./support/database.mjs";

test("Turn Limit stops scheduling before another model request", { timeout: 10000 }, async () => {
  const fixture = await createTestDatabase();
  let database, stopRuns;
  try {
    Object.assign(process.env, {
      DATABASE_URL: fixture.url,
      MODEL_PROVIDER: "ollama",
      MODEL: "scripted",
      OLLAMA_MODEL: "scripted",
      OLLAMA_URL: "http://scripted-model.test",
      SCRIPTED_MODEL_SCENARIO: "success",
    });
    await import("./support/scripted-model.mjs");
    database = await import("../src/db/index.ts");
    await database.migrateDatabase();
    const { createDebate } = await import("../src/orchestrator/groupDiscussion.ts");
    const { startRun, stopAllRuns } = await import("../src/orchestrator/runner.ts");
    stopRuns = stopAllRuns;
    const { loadEvents } = await import("../src/store/eventStore.ts");
    // The HTTP preflight prevents too-small limits. Exercise the runtime guard directly.
    await startRun("limited", "Test debate", 1, createDebate("Test debate", {}, 2));
    let events;
    const deadline = Date.now() + 4000;
    do {
      events = await loadEvents("limited");
      if (events.at(-1)?.type === "run_finished") break;
      await delay(10);
    } while (Date.now() < deadline);
    await stopAllRuns();
    assert.equal(events.at(-1).type, "run_finished");
    assert.equal(events.at(-1).status, "turn_limit_reached");
    assert.equal(events.at(-1).totals.turns, 1);
    assert.equal(events.filter(e => e.type === "model_request").length, 1);
    assert.equal(events.filter(e => e.type === "turn_started").length, 1);
    assert.equal(events.filter(e => e.type === "run_finished").length, 1);
  } finally {
    try {
      if (stopRuns) await stopRuns();
    } finally {
      if (database) await database.closeDatabase();
      await fixture.close();
    }
  }
});
