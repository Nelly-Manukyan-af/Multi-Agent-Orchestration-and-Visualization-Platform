// The one append path (PROJECT.md §6.1 #8, #9).
// append(): (1) assign the next seq, (2) write to the database, (3) broadcast.

import { asc, eq, gt, and, max } from "drizzle-orm";
import { applyEvent, initialState, totalUsage, type AgentEvent, type NewEvent, type RunState } from "@agent-platform/shared";
import { db } from "../db/index.ts";
import { events, runs } from "../db/schema.ts";

type Listener = (event: AgentEvent) => void;

const TOKEN_FLUSH_MS = 50;

const nextSeqByRun = new Map<string, number>();
const stateByRun = new Map<string, RunState>(); // server-side projection of runs in progress
const pendingTokens: AgentEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushFailed = false;
let listener: Listener = () => {};

/** The WebSocket hub registers here to receive every stored event. */
export function onAppend(fn: Listener): void {
  listener = fn;
}

export function append(runId: string, partial: NewEvent): AgentEvent {
  if (flushFailed || partial.type !== "llm_token") flushTokens();
  const seq = nextSeq(runId);
  const event = { ...partial, runId, seq, timestamp: Date.now() } as AgentEvent;

  if (event.type === "llm_token") {
    pendingTokens.push(event);
    flushTimer ??= setTimeout(() => {
      try {
        flushTokens();
      } catch (error) {
        console.error("Token persistence failed:", error);
      }
    }, TOKEN_FLUSH_MS);
  } else {
    try {
      write(event);
    } catch (error) {
      nextSeqByRun.set(runId, seq);
      throw error;
    }
    publish(event);
  }

  return event;
}

function publish(event: AgentEvent): void {
  const runId = event.runId;
  stateByRun.set(runId, applyEvent(stateByRun.get(runId) ?? initialState, event));
  if (event.type === "run_finished") {
    nextSeqByRun.delete(runId);
    stateByRun.delete(runId);
  }

  listener(event);
}

/** Current projected state of a run (in progress), rebuilt from the log if needed. */
export function getState(runId: string): RunState {
  const cached = stateByRun.get(runId);
  if (cached) return cached;
  const state = loadEvents(runId).reduce(applyEvent, initialState);
  stateByRun.set(runId, state);
  return state;
}

export function flushTokens(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pendingTokens.length === 0) return;
  try {
    db.transaction((tx) => {
      for (const event of pendingTokens) tx.insert(events).values(toRow(event)).run();
    });
  } catch (error) {
    flushFailed = true;
    throw error;
  }
  flushFailed = false;
  const batch = pendingTokens.splice(0);
  for (const event of batch) publish(event);
}

export function loadEvents(runId: string, afterSeq = 0): AgentEvent[] {
  flushTokens();
  return db
    .select()
    .from(events)
    .where(and(eq(events.runId, runId), gt(events.seq, afterSeq)))
    .orderBy(asc(events.seq))
    .all()
    .map((row) => JSON.parse(row.payload) as AgentEvent);
}

function nextSeq(runId: string): number {
  let seq = nextSeqByRun.get(runId);
  if (seq === undefined) {
    const [row] = db.select({ maxSeq: max(events.seq) }).from(events).where(eq(events.runId, runId)).all();
    seq = (row?.maxSeq ?? 0) + 1;
  }
  nextSeqByRun.set(runId, seq + 1);
  return seq;
}

function write(event: AgentEvent): void {
  db.transaction((tx) => {
    // The runs record is a projection of the log (FR7.1).
    if (event.type === "run_started") {
      tx.insert(runs)
        .values({
          id: event.runId,
          teamName: event.teamName,
          pattern: event.pattern,
          task: event.task,
          status: "running",
          startedAt: event.timestamp,
        })
        .run();
    }
    tx.insert(events).values(toRow(event)).run();
    if (event.type === "run_finished") {
      const state = stateByRun.get(event.runId);
      const usage = state ? totalUsage(state) : { promptTokens: 0, completionTokens: 0 };
      tx.update(runs)
        .set({
          status: event.status,
          finishedAt: event.timestamp,
          totalTokens: usage.promptTokens + usage.completionTokens,
          durationMs: state?.startedAt != null ? event.timestamp - state.startedAt : null,
        })
        .where(eq(runs.id, event.runId))
        .run();
    }
  });
}

function toRow(e: AgentEvent) {
  return { runId: e.runId, seq: e.seq, type: e.type, payload: JSON.stringify(e), timestamp: e.timestamp };
}
