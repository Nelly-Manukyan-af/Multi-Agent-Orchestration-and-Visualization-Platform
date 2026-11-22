import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { eq, desc, sql } from "drizzle-orm";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_TURN_LIMIT,
  TURN_LIMIT_MAX,
  TURN_LIMIT_MIN,
  minTurnLimit,
  type RunRecord,
  type StartRunRequest,
} from "@agent-platform/shared";
import { db, closeDatabase, migrateDatabase } from "./db/index.ts";
import { runs, agents } from "./db/schema.ts";
import { loadEvents, flushTokens } from "./store/eventStore.ts";
import { attachHub } from "./store/hub.ts";
import { closeOpenTurn, finishRun, startRun, stopRun, stopAllRuns } from "./orchestrator/runner.ts";
import { createDebate, DEFAULT_ROUNDS, type DebateAgentConfig } from "./orchestrator/groupDiscussion.ts";
import { listModels } from "./llm/client.ts";

// SR-NET: port and allowed origin come from the environment.
const PORT = Number(process.env.PORT ?? 3000);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 10000);
if (!Number.isSafeInteger(SHUTDOWN_TIMEOUT_MS) || SHUTDOWN_TIMEOUT_MS <= 0 || SHUTDOWN_TIMEOUT_MS > 2147483647) {
  throw new Error("SHUTDOWN_TIMEOUT_MS must be a positive integer no greater than 2147483647");
}
let shuttingDown = false;

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// FR4.7 Orphan recovery: close any run left "running" by a restart or deploy,
// so its log ends with turn_finished (aborted) and run_finished.
await migrateDatabase();
for (const { id } of await db.select({ id: runs.id }).from(runs).where(eq(runs.status, "running"))) {
  await closeOpenTurn(id, "aborted");
  await finishRun(id, "stopped", "Server restarted");
}

app.get("/health", async (_req, res) => {
  if (shuttingDown) return res.status(503).json({ ok: false });
  try {
    await db.execute(sql`select 1`);
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

// ---------- Runs ----------

app.get("/runs", async (_req, res) => {
  const all = await db.select().from(runs).orderBy(desc(runs.startedAt)) as RunRecord[];
  res.json(all);
});

app.get("/runs/:id", async (req, res) => {
  const [run] = await db.select().from(runs).where(eq(runs.id, req.params.id));
  if (!run) return res.status(404).json({ error: "Run not found" });
  res.json(run);
});

app.get("/runs/:id/events", async (req, res) => {
  const [run] = await db.select({ id: runs.id }).from(runs).where(eq(runs.id, req.params.id));
  if (!run) return res.status(404).json({ error: "Run not found" });
  res.json(await loadEvents(run.id));
});

// Start a run (FR4.1 pre-flight). The client then subscribes over /ws.
app.post("/runs", async (req, res) => {
  if (shuttingDown) return res.set("Connection", "close").status(503).json({ error: "Server shutting down" });
  const body = req.body as StartRunRequest;
  const task = typeof body.task === "string" ? body.task.trim() : "";
  const rounds = body.rounds ?? DEFAULT_ROUNDS;
  const turnLimit = body.turnLimit ?? DEFAULT_TURN_LIMIT;

  if (!task) return res.status(400).json({ error: "The task must not be empty." });
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10) {
    return res.status(400).json({ error: "Rounds must be an integer from 1 to 10." });
  }
  if (!Number.isInteger(turnLimit) || turnLimit < TURN_LIMIT_MIN || turnLimit > TURN_LIMIT_MAX) {
    return res.status(400).json({ error: `The Turn Limit must be an integer from ${TURN_LIMIT_MIN} to ${TURN_LIMIT_MAX}.` });
  }
  const minimum = minTurnLimit("group_discussion", { rounds, debaters: 2 });
  if (turnLimit < minimum) {
    return res
      .status(400)
      .json({ error: `The Turn Limit must be at least ${minimum} for ${rounds} rounds (rounds × 2 debaters + Judge).` });
  }

  const custom: Partial<Record<"pro" | "con" | "judge", DebateAgentConfig>> = {};
  for (const [slot, id] of [
    ["pro", body.proId],
    ["con", body.conId],
    ["judge", body.judgeId],
  ] as const) {
    if (!id) continue;
    const [found] = await db.select().from(agents).where(eq(agents.id, id));
    if (!found) return res.status(400).json({ error: `The agent selected for ${slot} no longer exists.` });
    custom[slot] = found;
  }

  const runId = crypto.randomUUID();
  const strategy = createDebate(task, custom, rounds);
  if (strategy.snapshot.some((agent) => agent.provider === "gemini") && !process.env.GEMINI_API_KEY?.trim()) {
    return res.status(400).json({ error: "Configure GEMINI_API_KEY on the server before using Gemini agents." });
  }
  if (shuttingDown) return res.set("Connection", "close").status(503).json({ error: "Server shutting down" });
  await startRun(runId, task, turnLimit, strategy);
  res.status(201).json({ runId });
});

// Stop (FR4.2)
app.post("/runs/:id/stop", (req, res) => {
  if (!stopRun(req.params.id)) return res.status(404).json({ error: "No active run with this id" });
  res.status(202).json({ ok: true });
});

// ---------- Agents (becomes /agent-templates in Phase 3, FR2) ----------

app.get("/agents", async (_req, res) => {
  res.json(await db.select().from(agents).orderBy(desc(agents.createdAt)));
});

app.post("/agents", async (req, res) => {
  const { name, role, model, provider = "ollama" } = req.body ?? {};
  if (typeof name !== "string" || !name.trim() || typeof role !== "string" || !role.trim() || typeof model !== "string" || !model.trim()) {
    return res.status(400).json({ error: "name, role and model must be nonempty strings" });
  }
  if (provider !== "ollama" && provider !== "gemini") return res.status(400).json({ error: "Invalid model provider" });
  const [created] = await db
    .insert(agents)
    .values({ id: crypto.randomUUID(), name, role, model, provider, createdAt: Date.now() })
    .returning();
  res.status(201).json(created);
});

app.put("/agents/:id", async (req, res) => {
  const { name, role, model, provider } = req.body ?? {};
  if (provider !== undefined && provider !== "ollama" && provider !== "gemini") {
    return res.status(400).json({ error: "Invalid model provider" });
  }
  const [updated] = await db.update(agents).set({ name, role, model, provider }).where(eq(agents.id, req.params.id)).returning();
  if (!updated) return res.status(404).json({ error: "Agent not found" });
  res.json(updated);
});

app.delete("/agents/:id", async (req, res) => {
  await db.delete(agents).where(eq(agents.id, req.params.id));
  res.status(204).end();
});

app.get("/models", async (_req, res) => {
  res.json(await listModels());
});

if (process.env.STATIC_DIR) {
  const directory = resolve(process.env.STATIC_DIR);
  if (!existsSync(resolve(directory, "index.html"))) throw new Error("STATIC_DIR must contain the built frontend");
  app.use(express.static(directory));
}

const server = createServer(app);
const closeHub = attachHub(server);

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("Server shutting down");
  const deadline = setTimeout(() => {
    console.error("Server shutdown timed out");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  const httpClosed = new Promise<void>((resolve) => server.close(() => resolve()));

  try {
    await stopAllRuns();
    await flushTokens();
    await Promise.all([closeHub(), httpClosed]);
    await closeDatabase();
    clearTimeout(deadline);
    process.exit(0);
  } catch (error) {
    console.error("Server shutdown failed:", error);
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

server.listen(PORT, () => {
  const address = server.address();
  console.log(`Server listening on http://localhost:${typeof address === "object" && address ? address.port : PORT}`);
});
