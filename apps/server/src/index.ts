import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { eq, desc } from "drizzle-orm";
import {
  DEFAULT_TURN_LIMIT,
  TURN_LIMIT_MAX,
  TURN_LIMIT_MIN,
  minTurnLimit,
  type RunRecord,
  type StartRunRequest,
} from "@agent-platform/shared";
import { db } from "./db/index.ts";
import { runs, agents } from "./db/schema.ts";
import { loadEvents } from "./store/eventStore.ts";
import { attachHub } from "./store/hub.ts";
import { closeOpenTurn, finishRun, startRun, stopRun } from "./orchestrator/runner.ts";
import { createDebate, DEFAULT_ROUNDS, type DebateAgentConfig } from "./orchestrator/groupDiscussion.ts";
import { listModels } from "./llm/client.ts";

// SR-NET: port and allowed origin come from the environment.
const PORT = Number(process.env.PORT ?? 3000);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// FR4.7 Orphan recovery: close any run left "running" by a restart or deploy,
// so its log ends with turn_finished (aborted) and run_finished.
for (const { id } of db.select({ id: runs.id }).from(runs).where(eq(runs.status, "running")).all()) {
  closeOpenTurn(id, "aborted");
  finishRun(id, "stopped", "Server restarted");
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// ---------- Runs ----------

app.get("/runs", (_req, res) => {
  const all = db.select().from(runs).orderBy(desc(runs.startedAt)).all() as RunRecord[];
  res.json(all);
});

app.get("/runs/:id", (req, res) => {
  const [run] = db.select().from(runs).where(eq(runs.id, req.params.id)).all();
  if (!run) return res.status(404).json({ error: "Run not found" });
  res.json(run);
});

app.get("/runs/:id/events", (req, res) => {
  const [run] = db.select({ id: runs.id }).from(runs).where(eq(runs.id, req.params.id)).all();
  if (!run) return res.status(404).json({ error: "Run not found" });
  res.json(loadEvents(run.id));
});

// Start a run (FR4.1 pre-flight). The client then subscribes over /ws.
app.post("/runs", (req, res) => {
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
    const [found] = db.select().from(agents).where(eq(agents.id, id)).all();
    if (!found) return res.status(400).json({ error: `The agent selected for ${slot} no longer exists.` });
    custom[slot] = found;
  }

  const runId = crypto.randomUUID();
  const strategy = createDebate(task, custom, rounds);
  if (strategy.snapshot.some((agent) => agent.provider === "gemini") && !process.env.GEMINI_API_KEY?.trim()) {
    return res.status(400).json({ error: "Configure GEMINI_API_KEY on the server before using Gemini agents." });
  }
  startRun(runId, task, turnLimit, strategy);
  res.status(201).json({ runId });
});

// Stop (FR4.2)
app.post("/runs/:id/stop", (req, res) => {
  if (!stopRun(req.params.id)) return res.status(404).json({ error: "No active run with this id" });
  res.status(202).json({ ok: true });
});

// ---------- Agents (becomes /agent-templates in Phase 3, FR2) ----------

app.get("/agents", (_req, res) => {
  res.json(db.select().from(agents).orderBy(desc(agents.createdAt)).all());
});

app.post("/agents", (req, res) => {
  const { name, role, model, provider = "ollama" } = req.body ?? {};
  if (typeof name !== "string" || !name.trim() || typeof role !== "string" || !role.trim() || typeof model !== "string" || !model.trim()) {
    return res.status(400).json({ error: "name, role and model must be nonempty strings" });
  }
  if (provider !== "ollama" && provider !== "gemini") return res.status(400).json({ error: "Invalid model provider" });
  const [created] = db
    .insert(agents)
    .values({ id: crypto.randomUUID(), name, role, model, provider, createdAt: Date.now() })
    .returning()
    .all();
  res.status(201).json(created);
});

app.put("/agents/:id", (req, res) => {
  const { name, role, model, provider } = req.body ?? {};
  if (provider !== undefined && provider !== "ollama" && provider !== "gemini") {
    return res.status(400).json({ error: "Invalid model provider" });
  }
  const [updated] = db.update(agents).set({ name, role, model, provider }).where(eq(agents.id, req.params.id)).returning().all();
  if (!updated) return res.status(404).json({ error: "Agent not found" });
  res.json(updated);
});

app.delete("/agents/:id", (req, res) => {
  db.delete(agents).where(eq(agents.id, req.params.id)).run();
  res.status(204).end();
});

app.get("/models", async (_req, res) => {
  res.json(await listModels());
});

const server = createServer(app);
attachHub(server);

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
