import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { runDebate } from "./orchestrator/debate.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Health check endpoint
app.get("/health", (_req, res) => {
    res.json({ ok: true });
});

// Echo test endpoint
app.post("/echo", (req, res) => {
    res.json(req.body);
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket) => {
    socket.on("message", async (raw) => {
        try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === "start_run") {
                const runId = crypto.randomUUID();
                await runDebate(runId, msg.topic, (event) => {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify(event));
                    }
                });
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
