// WebSocket hub (FR7.3): subscribe { runId, afterSeq } → stored events after
// afterSeq, then live events. Everything here is synchronous (better-sqlite3),
// so no event can slip between the catch-up read and joining the live set.

import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { eq } from "drizzle-orm";
import type { AgentEvent, ServerMessage } from "@agent-platform/shared";
import { db } from "../db/index.ts";
import { runs } from "../db/schema.ts";
import { loadEvents, onAppend } from "./eventStore.ts";

const subscribers = new Map<string, Set<WebSocket>>();

export function attachHub(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  onAppend((event) => {
    const set = subscribers.get(event.runId);
    if (!set) return;
    const data = JSON.stringify({ type: "event", event } satisfies ServerMessage);
    for (const socket of set) {
      if (socket.readyState === WebSocket.OPEN) socket.send(data);
    }
    if (event.type === "run_finished") subscribers.delete(event.runId);
  });

  wss.on("connection", (socket) => {
    socket.on("message", (raw) => {
      let msg: unknown;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (typeof msg !== "object" || msg === null || !("type" in msg) || msg.type !== "subscribe") return;
      if (!("runId" in msg) || typeof msg.runId !== "string" || !msg.runId) return;
      if (!("afterSeq" in msg) || typeof msg.afterSeq !== "number" || !Number.isSafeInteger(msg.afterSeq) || msg.afterSeq < 0) return;
      try {
        subscribe(socket, msg.runId, msg.afterSeq);
      } catch (error) {
        console.error("Run subscription failed:", error);
        send(socket, { type: "error", runId: msg.runId, message: "Unable to load run events" });
      }
    });

    socket.on("close", () => {
      for (const set of subscribers.values()) set.delete(socket);
    });
  });
}

function subscribe(socket: WebSocket, runId: string, afterSeq: number): void {
  // TODO(FR9.3): once sign-in exists, accept only if the signed-in user owns the run.
  const [run] = db.select({ status: runs.status }).from(runs).where(eq(runs.id, runId)).all();
  if (!run) {
    send(socket, { type: "error", runId, message: "Run not found" });
    return;
  }

  subscribers.get(runId)?.delete(socket); // a re-subscribe replaces the old subscription

  const stored: AgentEvent[] = loadEvents(runId, Number.isInteger(afterSeq) ? afterSeq : 0);
  for (const event of stored) send(socket, { type: "event", event });

  if (run.status === "running") {
    let set = subscribers.get(runId);
    if (!set) subscribers.set(runId, (set = new Set()));
    set.add(socket);
  }
}

function send(socket: WebSocket, msg: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}
