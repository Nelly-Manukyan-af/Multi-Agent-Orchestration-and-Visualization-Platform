import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { eq } from "drizzle-orm";
import type { AgentEvent, ServerMessage } from "@agent-platform/shared";
import { db } from "../db/index.ts";
import { runs } from "../db/schema.ts";
import { getLastSeq, loadEventPage, onAppend } from "./eventStore.ts";

type Subscription = {
  socket: WebSocket;
  runId: string;
  cursor: number;
  buffering: boolean;
  pending: AgentEvent[];
};

export function attachHub(server: Server): () => Promise<void> {
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 4096 });
  const subscriptions = new Map<WebSocket, Subscription>();
  let closing = false;

  const current = (subscription: Subscription) => subscriptions.get(subscription.socket) === subscription;
  const deliver = (subscription: Subscription, event: AgentEvent): boolean => {
    if (!current(subscription) || subscription.socket.readyState !== WebSocket.OPEN) return false;
    if (event.seq <= subscription.cursor) return true;
    if (subscription.socket.bufferedAmount > 1024 * 1024) {
      subscriptions.delete(subscription.socket);
      subscription.socket.close(1013, "Reconnect to resume events");
      return false;
    }
    send(subscription.socket, { type: "event", event });
    subscription.cursor = event.seq;
    if (event.type === "run_finished") subscriptions.delete(subscription.socket);
    return true;
  };

  onAppend((event) => {
    for (const subscription of subscriptions.values()) {
      if (subscription.runId !== event.runId) continue;
      if (!subscription.buffering) {
        deliver(subscription, event);
      } else if (subscription.pending.length >= 1000) {
        subscriptions.delete(subscription.socket);
        subscription.socket.close(1013, "Reconnect to resume events");
      } else {
        subscription.pending.push(event);
      }
    }
  });

  async function subscribe(subscription: Subscription): Promise<void> {
    const { socket, runId } = subscription;
    try {
      const [run] = await db.select({ id: runs.id }).from(runs).where(eq(runs.id, runId));
      if (!current(subscription)) return;
      if (!run) {
        subscriptions.delete(socket);
        send(socket, { type: "error", runId, message: "Run not found" });
        return;
      }
      const throughSeq = await getLastSeq(runId);
      while (current(subscription) && subscription.cursor < throughSeq) {
        const page = await loadEventPage(runId, subscription.cursor, throughSeq);
        if (!current(subscription) || page.length === 0) break;
        for (const event of page) if (!deliver(subscription, event)) return;
      }
      if (!current(subscription)) return;
      for (const event of subscription.pending) if (!deliver(subscription, event)) return;
      subscription.pending = [];
      subscription.buffering = false;
    } catch (error) {
      if (!current(subscription)) return;
      subscriptions.delete(socket);
      console.error("Run subscription failed:", error);
      send(socket, { type: "error", runId, message: "Unable to load run events" });
      socket.close(1013, "Reconnect to resume events");
    }
  }

  wss.on("connection", (socket) => {
    socket.on("error", () => subscriptions.delete(socket));
    socket.on("message", (raw) => {
      if (closing) return;
      let message: unknown;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (typeof message !== "object" || message === null || !("type" in message) || message.type !== "subscribe") return;
      if (!("runId" in message) || typeof message.runId !== "string" || !message.runId) return;
      if (!("afterSeq" in message) || typeof message.afterSeq !== "number" || !Number.isSafeInteger(message.afterSeq) || message.afterSeq < 0) return;
      const subscription: Subscription = {
        socket, runId: message.runId, cursor: message.afterSeq, buffering: true, pending: [],
      };
      subscriptions.set(socket, subscription);
      void subscribe(subscription);
    });
    socket.on("close", () => subscriptions.delete(socket));
  });

  return () => new Promise<void>((resolve, reject) => {
    closing = true;
    subscriptions.clear();
    wss.close((error) => error ? reject(error) : resolve());
    for (const socket of wss.clients) socket.close(1001, "Server shutting down");
  });
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}
