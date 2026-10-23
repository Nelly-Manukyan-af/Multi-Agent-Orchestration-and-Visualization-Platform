import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { runDebate } from "./orchestrator/debate.ts";
import { db } from "./db/index.ts";
import { runs, events, agents } from "./db/schema.ts";
import { eq, desc } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors()); // Allow requests from Vite frontend
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// On server start: mark any orphaned "running" runs as "stopped"
db.update(runs)
    .set({ status: "stopped", finishedAt: Date.now() })
    .where(eq(runs.status, "running"))
    .run();

// Health check endpoint
app.get("/health", (_req, res) => {
    res.json({ ok: true });
});

// Echo test endpoint
app.post("/echo", (req, res) => {
    res.json(req.body);
});

// 1. Get all past runs (newest first)
app.get("/runs", (_req, res) => {
    const allRuns = db.select().from(runs).orderBy(desc(runs.startedAt)).all();
    res.json(allRuns);
});

// 2. Get all saved events for a specific run in order
app.get("/runs/:id/events", (req, res) => {
    const runEvents = db
        .select()
        .from(events)
        .where(eq(events.runId, req.params.id))
        .orderBy(events.seq)
        .all();

    const parsed = runEvents.map((e) => JSON.parse(e.payload));
    res.json(parsed);
});

// Agents endpoints
app.get("/agents", (_req, res) => {
    const allAgents = db.select().from(agents).orderBy(desc(agents.createdAt)).all();
    res.json(allAgents);
});

app.post("/agents", (req, res) => {
    const [newAgent] = db
        .insert(agents)
        .values({
            id: crypto.randomUUID(),
            name: req.body.name,
            role: req.body.role,
            model: req.body.model,
            createdAt: Date.now(),
        })
        .returning()
        .all();

    res.status(201).json(newAgent);
});

app.put("/agents/:id", (req, res) => {
    const [updated] = db
        .update(agents)
        .set({
            name: req.body.name,
            role: req.body.role,
            model: req.body.model,
        })
        .where(eq(agents.id, req.params.id))
        .returning()
        .all();

    res.json(updated ?? { ok: true });
});

app.delete("/agents/:id", (req, res) => {
    db.delete(agents).where(eq(agents.id, req.params.id)).run();
    res.json({ ok: true });
});

app.get("/models", async (_req, res) => {
    try {
        const response = await fetch("http://localhost:11434/api/tags");
        if (!response.ok) {
            return res.json(["qwen3:8b"]);
        }
        const data = await response.json();
        const modelNames = data.models?.map((m: { name: string }) => m.name) ?? ["qwen3:8b"];
        res.json(modelNames);
    } catch {
        res.json(["qwen3:8b"]); // fallback if Ollama isn't reachable
    }
});
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket) => {
    socket.on("message", async (raw) => {
        try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === "start_run") {
                const runId = crypto.randomUUID();
                const customAgents: { pro?: any; con?: any; judge?: any } = {};
                if (msg.proId) {
                    const [a] = db.select().from(agents).where(eq(agents.id, msg.proId)).all();
                    if (a) customAgents.pro = a;
                }
                if (msg.conId) {
                    const [a] = db.select().from(agents).where(eq(agents.id, msg.conId)).all();
                    if (a) customAgents.con = a;
                }
                if (msg.judgeId) {
                    const [a] = db.select().from(agents).where(eq(agents.id, msg.judgeId)).all();
                    if (a) customAgents.judge = a;
                }

                db.insert(runs)
                    .values({
                        id: runId,
                        task: msg.topic,
                        status: "running",
                        startedAt: Date.now(),
                    })
                    .run();

                let seq = 1;
                try {
                    await runDebate(runId, msg.topic, (event) => {
                        db.insert(events)
                            .values({
                                id: crypto.randomUUID(),
                                runId,
                                seq: seq++,
                                type: event.type,
                                payload: JSON.stringify(event),
                                timestamp: Date.now(),
                            })
                            .run();

                        if (socket.readyState === WebSocket.OPEN) {
                            socket.send(JSON.stringify(event));
                        }
                    }, customAgents);

                    db.update(runs)
                        .set({ status: "completed", finishedAt: Date.now() })
                        .where(eq(runs.id, runId))
                        .run();
                } catch (runErr) {
                    console.error("Debate failed:", runErr);
                    db.update(runs)
                        .set({ status: "failed", finishedAt: Date.now() })
                        .where(eq(runs.id, runId))
                        .run();
                }
            }
        } catch (err) {
            console.error("Failed to handle WebSocket message:", err);
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
