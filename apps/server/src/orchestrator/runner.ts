// Runs a pattern from run_started to run_finished: Stop, loop rule (FR4.5),
// Turn Limit (FR4.4), fail fast (FR4.6) and the final status (FR4.3).

import {
  detectLoop,
  openTurn,
  totalUsage,
  type AgentSnapshot,
  type FinalStatus,
  type Pattern,
  type RunState,
} from "@agent-platform/shared";
import { append, getState, onPersistenceError, PersistenceError } from "../store/eventStore.ts";
import { executeTurn, type TurnPlan } from "./turnExecutor.ts";

/** A pattern decides only who speaks next and whether the Run is finished. */
export type PatternStrategy = {
  teamName: string;
  pattern: Pattern;
  snapshot: AgentSnapshot[];
  topology: { from: string; to: string }[];
  rounds?: number;
  /** The next Turn to run, or null if the pattern has nothing left to schedule. */
  next(state: RunState): TurnPlan | null;
  /** True if the Run has reached the pattern's normal end (FR3.1). */
  isFinished(state: RunState): boolean;
};

const activeRuns = new Map<string, { controller: AbortController; completion: Promise<void>; finishing: boolean }>();
let acceptingRuns = true;

onPersistenceError((runId, error) => activeRuns.get(runId)?.controller.abort(error));

export function stopRun(runId: string): boolean {
  const run = activeRuns.get(runId);
  if (!run || run.finishing) return false;
  run.controller.abort("Stopped by user");
  return true;
}

export async function stopAllRuns(): Promise<void> {
  acceptingRuns = false;
  const running = [...activeRuns.values()];
  for (const run of running) run.controller.abort("Server shutting down");
  const results = await Promise.allSettled(running.map((run) => run.completion));
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
}

export async function startRun(runId: string, task: string, turnLimit: number, strategy: PatternStrategy): Promise<void> {
  if (!acceptingRuns) throw new Error("Server shutting down");
  const controller = new AbortController();

  const started = append(runId, {
    type: "run_started",
    snapshot: strategy.snapshot,
    task,
    teamName: strategy.teamName,
    pattern: strategy.pattern,
    topology: strategy.topology,
    turnLimit,
    rounds: strategy.rounds,
  });

  const completion = started.then(() => execute(runId, turnLimit, strategy, controller.signal))
    .finally(() => activeRuns.delete(runId));
  activeRuns.set(runId, { controller, completion, finishing: false });
  void completion.catch((error) => console.error(`Run ${runId} could not be finalized:`, error));
  await started;
}

async function execute(runId: string, turnLimit: number, strategy: PatternStrategy, signal: AbortSignal) {
  const emit = (e: Parameters<typeof append>[1]) => append(runId, e);
  const nameOf = (id: string) => strategy.snapshot.find((a) => a.id === id)?.name ?? id;
  let turns = 0;

  try {
    while (true) {
      const currentState = await getState(runId);
      if (signal.aborted) {
        if (signal.reason instanceof PersistenceError) throw signal.reason;
        return finishRun(runId, "stopped", signal.reason, turns);
      }

      const plan = strategy.next(currentState);
      if (!plan) return finishRun(runId, "failed", "Pattern had no next Turn before its normal end", turns);

      turns++;
      const result = await executeTurn({ emit, signal }, plan, turns);
      const state = await getState(runId);

      if (signal.aborted || result.status === "aborted") {
        if (signal.reason instanceof PersistenceError) throw signal.reason;
        return finishRun(runId, "stopped", signal.reason, turns);
      }
      if (result.status === "error") {
        return finishRun(runId, "failed", `${plan.agent.name} failed in Turn ${turns}: ${result.error ?? "error"}`, turns);
      }

      const loop = detectLoop(state, plan.agent.id);
      if (loop) {
        return finishRun(
          runId,
          "loop_detected",
          `${nameOf(loop.agentId)} repeated itself in Turns ${loop.turns[0]} and ${loop.turns[1]}`,
          turns,
        );
      }

      if (strategy.isFinished(state)) return finishRun(runId, "completed", "Pattern finished normally", turns);
      if (turns >= turnLimit) return finishRun(runId, "turn_limit_reached", `Turn Limit of ${turnLimit} reached`, turns);
    }
  } catch (err) {
    console.error(`Run ${runId} crashed:`, err instanceof Error ? err.message : err);
    await closeOpenTurn(runId, "error", "Internal error");
    return finishRun(runId, "failed", "Internal error", turns);
  }
}

export async function finishRun(runId: string, status: FinalStatus, reason: string, turns?: number): Promise<void> {
  const active = activeRuns.get(runId);
  if (active) active.finishing = true;
  const state = await getState(runId);
  await append(runId, {
    type: "run_finished",
    status,
    reason,
    totals: {
      ...totalUsage(state),
      turns: turns ?? state.turnOrder.length,
      durationMs: state.startedAt != null ? Date.now() - state.startedAt : 0,
    },
  });
}

/** Closes a Turn left open (crash, server restart) so the log stays well-formed. */
export async function closeOpenTurn(runId: string, status: "aborted" | "error", error?: string): Promise<void> {
  const turn = openTurn(await getState(runId));
  if (!turn) return;
  await append(runId, {
    type: "turn_finished",
    turnId: turn.turnId,
    status,
    truncated: false,
    usage: { promptTokens: 0, completionTokens: 0 },
    durationMs: 0,
    rawOutput: turn.output,
    error,
  });
}
