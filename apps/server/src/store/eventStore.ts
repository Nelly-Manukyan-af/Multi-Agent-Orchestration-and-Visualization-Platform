import { asc, eq, gt, and, max, lte } from "drizzle-orm";
import { applyEvent, initialState, type AgentEvent, type NewEvent, type RunState } from "@agent-platform/shared";
import { db } from "../db/index.ts";
import { events, runs } from "../db/schema.ts";

export class PersistenceError extends Error {}

type RunLog = {
  tail: Promise<unknown>;
  state?: RunState;
  nextSeq?: number;
  pending: AgentEvent[];
  timer?: ReturnType<typeof setTimeout>;
  failure?: PersistenceError;
};

const logs = new Map<string, RunLog>();
let listener: (event: AgentEvent) => void = () => {};
let failureListener: (runId: string, error: PersistenceError) => void = () => {};

export function onAppend(callback: typeof listener): void {
  listener = callback;
}

export function onPersistenceError(callback: typeof failureListener): void {
  failureListener = callback;
}

function enqueue<Result>(runId: string, operation: (log: RunLog) => Promise<Result>): Promise<Result> {
  let log = logs.get(runId);
  if (!log) {
    log = { tail: Promise.resolve(), pending: [] };
    logs.set(runId, log);
  }
  const current = log;
  const result = current.tail.then(() => operation(current));
  current.tail = result.catch(() => {});
  return result;
}

export function append(runId: string, partial: NewEvent): Promise<AgentEvent> {
  return enqueue(runId, async (log) => {
    if (log.failure && partial.type === "llm_token") throw log.failure;
    if (partial.type !== "llm_token") await flushPending(runId, log);
    log.state ??= await readState(runId);
    log.nextSeq ??= (await readLastSeq(runId)) + 1;
    const event = { ...partial, runId, seq: log.nextSeq, timestamp: Date.now() } as AgentEvent;
    if (event.type === "llm_token") {
      log.pending.push(event);
      log.nextSeq++;
      log.timer ??= setTimeout(() => {
        log.timer = undefined;
        void enqueue(runId, (current) => flushPending(runId, current))
          .catch((error) => console.error(`Run ${runId} token persistence failed:`, error));
      }, 50);
      if (log.pending.length >= 100) await flushPending(runId, log);
    } else {
      await commit(runId, log, [event]);
      log.nextSeq++;
      if (event.type === "run_finished") logs.delete(runId);
    }
    return event;
  });
}

export function getState(runId: string): Promise<RunState> {
  return enqueue(runId, async (log) => {
    await flushPending(runId, log);
    log.state ??= await readState(runId);
    return log.state;
  });
}

export async function flushTokens(runId?: string): Promise<void> {
  const ids = runId ? (logs.has(runId) ? [runId] : []) : [...logs.keys()];
  const results = await Promise.allSettled(ids.map((id) => enqueue(id, (log) => flushPending(id, log))));
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
}

async function flushPending(runId: string, log: RunLog): Promise<void> {
  if (log.timer) clearTimeout(log.timer);
  log.timer = undefined;
  if (log.pending.length === 0) return;
  const batch = log.pending.slice();
  await commit(runId, log, batch);
  log.pending.splice(0, batch.length);
}

async function commit(runId: string, log: RunLog, batch: AgentEvent[]): Promise<void> {
  try {
    await db.transaction(async (transaction) => {
      for (const event of batch) {
        if (event.type === "run_started") {
          await transaction.insert(runs).values({
            id: runId, teamName: event.teamName, pattern: event.pattern,
            task: event.task, status: "running", startedAt: event.timestamp,
          });
        }
        await transaction.insert(events).values({
          runId, seq: event.seq, type: event.type, payload: event, timestamp: event.timestamp,
        });
        if (event.type === "run_finished") {
          await transaction.update(runs).set({
            status: event.status,
            finishedAt: event.timestamp,
            totalTokens: event.totals.promptTokens + event.totals.completionTokens,
            durationMs: event.totals.durationMs,
          }).where(eq(runs.id, runId));
        }
      }
    });
  } catch (cause) {
    const error = new PersistenceError("Unable to persist run events", { cause });
    log.failure = error;
    failureListener(runId, error);
    throw error;
  }
  for (const event of batch) {
    log.state = applyEvent(log.state ?? initialState, event);
    listener(event);
  }
}

async function readLastSeq(runId: string): Promise<number> {
  const [row] = await db.select({ seq: max(events.seq) }).from(events).where(eq(events.runId, runId));
  return Number(row?.seq ?? 0);
}

export async function getLastSeq(runId: string): Promise<number> {
  await flushTokens(runId);
  return readLastSeq(runId);
}

export async function loadEventPage(runId: string, afterSeq = 0, throughSeq?: number): Promise<AgentEvent[]> {
  const rows = await db.select({ payload: events.payload }).from(events)
    .where(and(eq(events.runId, runId), gt(events.seq, afterSeq),
      throughSeq === undefined ? undefined : lte(events.seq, throughSeq)))
    .orderBy(asc(events.seq)).limit(500);
  return rows.map((row) => row.payload);
}

export async function loadEvents(runId: string, afterSeq = 0): Promise<AgentEvent[]> {
  const throughSeq = await getLastSeq(runId);
  const result: AgentEvent[] = [];
  let cursor = afterSeq;
  while (cursor < throughSeq) {
    const page = await loadEventPage(runId, cursor, throughSeq);
    if (page.length === 0) break;
    result.push(...page);
    cursor = page.at(-1)!.seq;
  }
  return result;
}

async function readState(runId: string): Promise<RunState> {
  let state = initialState;
  while (true) {
    const page = await loadEventPage(runId, state.lastSeq);
    if (page.length === 0) return state;
    state = page.reduce(applyEvent, state);
  }
}
