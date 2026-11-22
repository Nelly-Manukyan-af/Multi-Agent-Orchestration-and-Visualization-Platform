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
import { append, getState } from "../store/eventStore.ts";
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

const activeRuns = new Map<string, AbortController>();

export function stopRun(runId: string): boolean {
  const controller = activeRuns.get(runId);
  if (!controller) return false;
  controller.abort();
  return true;
}

/** Appends run_started synchronously, then runs the Turns in the background. */
export function startRun(runId: string, task: string, turnLimit: number, strategy: PatternStrategy): void {
  const controller = new AbortController();

  append(runId, {
    type: "run_started",
    snapshot: strategy.snapshot,
    task,
    teamName: strategy.teamName,
    pattern: strategy.pattern,
    topology: strategy.topology,
    turnLimit,
    rounds: strategy.rounds,
  });

  activeRuns.set(runId, controller);
  void execute(runId, turnLimit, strategy, controller.signal)
    .finally(() => activeRuns.delete(runId))
    .catch((error) => console.error(`Run ${runId} could not be finalized:`, error));
}

async function execute(runId: string, turnLimit: number, strategy: PatternStrategy, signal: AbortSignal) {
  const emit = (e: Parameters<typeof append>[1]) => append(runId, e);
  const nameOf = (id: string) => strategy.snapshot.find((a) => a.id === id)?.name ?? id;
  let turns = 0;

  try {
    while (true) {
      if (signal.aborted) return finishRun(runId, "stopped", "Stopped by user", turns);

      const plan = strategy.next(getState(runId));
      if (!plan) return finishRun(runId, "failed", "Pattern had no next Turn before its normal end", turns);

      turns++;
      const result = await executeTurn({ emit, signal }, plan, turns);
      const state = getState(runId);

      if (result.status === "aborted") return finishRun(runId, "stopped", "Stopped by user", turns);
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
    closeOpenTurn(runId, "error", "Internal error");
    return finishRun(runId, "failed", "Internal error", turns);
  }
}

export function finishRun(runId: string, status: FinalStatus, reason: string, turns?: number): void {
  const state = getState(runId);
  append(runId, {
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
export function closeOpenTurn(runId: string, status: "aborted" | "error", error?: string): void {
  const turn = openTurn(getState(runId));
  if (!turn) return;
  append(runId, {
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
