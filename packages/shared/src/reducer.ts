// The one reducer (PROJECT.md §6.1 #3 and #7).
// RunState = events.reduce(applyEvent, initialState)
// It reads nothing but the events: no clock, no randomness, no external state.
// The browser uses it for the live view, reconnect and Replay; the server uses it
// for the `runs` projection, loop detection and orphan recovery.

import type {
  AgentEvent,
  AgentSnapshot,
  ChatMessage,
  FinalStatus,
  ModelSettings,
  Pattern,
  RetryReason,
  RunStatus,
  TokenUsage,
  TurnStatus,
} from "./events.ts";

/** Node states (§9.1). */
export type NodeState = "idle" | "thinking" | "speaking" | "tool_calling" | "error";

export type AgentState = {
  id: string;
  name: string;
  role: string;
  status: NodeState;
  liveText: string; // text of the current (or last) Turn
  tokens: number; // completion tokens over the whole Run
  currentTurnId: string | null;
  openToolCalls: string[]; // callIds of tool calls still waiting for a result
  activeTool: string | null; // badge text, e.g. calculate({"a":1})
};

export type ToolCallState = {
  callId: string;
  tool: string;
  args: string;
  result?: string;
  error?: string;
  durationMs?: number;
};

export type TurnState = {
  turnId: string;
  agentId: string;
  turn: number;
  delegationCallId?: string;
  status: "running" | TurnStatus;
  requests: { attempt: number; messages: ChatMessage[]; settings: ModelSettings }[];
  output: string; // streamed content of the latest attempt
  reasoning: string;
  message: string | null; // text of the agent_message, if any
  toolCalls: ToolCallState[];
  retries: { reason: RetryReason; attempt: number }[];
  usage: TokenUsage | null;
  durationMs: number | null;
  truncated: boolean;
  rawOutput: string | null;
  error?: string;
};

export type MessageItem = {
  seq: number;
  turnId: string;
  from: string;
  to: string[]; // [] = final answer, no edge (FR6.2)
  text: string;
  timestamp: number;
};

export type RunState = {
  runId: string | null;
  status: "idle" | RunStatus; // "idle" = no run_started applied yet (UI only, §9.2)
  task: string;
  teamName: string;
  pattern: Pattern | null;
  turnLimit: number;
  rounds?: number;
  snapshot: AgentSnapshot[];
  agentOrder: string[];
  agents: Record<string, AgentState>;
  turns: Record<string, TurnState>;
  turnOrder: string[];
  messages: MessageItem[];
  reason: string | null;
  totals: (TokenUsage & { turns: number; durationMs: number }) | null;
  startedAt: number | null;
  finishedAt: number | null;
  lastSeq: number;
};

export const initialState: RunState = {
  runId: null,
  status: "idle",
  task: "",
  teamName: "",
  pattern: null,
  turnLimit: 0,
  snapshot: [],
  agentOrder: [],
  agents: {},
  turns: {},
  turnOrder: [],
  messages: [],
  reason: null,
  totals: null,
  startedAt: null,
  finishedAt: null,
  lastSeq: 0,
};

export function applyEvent(prev: RunState, event: AgentEvent): RunState {
  const state = { ...prev, lastSeq: event.seq };

  switch (event.type) {
    case "run_started": {
      const agents: Record<string, AgentState> = {};
      for (const a of event.snapshot) {
        agents[a.id] = {
          id: a.id,
          name: a.name,
          role: a.role,
          status: "idle",
          liveText: "",
          tokens: 0,
          currentTurnId: null,
          openToolCalls: [],
          activeTool: null,
        };
      }
      return {
        ...initialState,
        lastSeq: event.seq,
        runId: event.runId,
        status: "running",
        task: event.task,
        teamName: event.teamName,
        pattern: event.pattern,
        turnLimit: event.turnLimit,
        rounds: event.rounds,
        snapshot: event.snapshot,
        agentOrder: event.snapshot.map((a) => a.id),
        agents,
        startedAt: event.timestamp,
      };
    }

    case "turn_started": {
      const turn: TurnState = {
        turnId: event.turnId,
        agentId: event.agentId,
        turn: event.turn,
        delegationCallId: event.delegationCallId,
        status: "running",
        requests: [],
        output: "",
        reasoning: "",
        message: null,
        toolCalls: [],
        retries: [],
        usage: null,
        durationMs: null,
        truncated: false,
        rawOutput: null,
      };
      return {
        ...updateAgent(state, event.agentId, (a) => ({
          ...a,
          status: "thinking",
          liveText: "",
          currentTurnId: event.turnId,
          openToolCalls: [],
          activeTool: null,
        })),
        turns: { ...state.turns, [event.turnId]: turn },
        turnOrder: [...state.turnOrder, event.turnId],
      };
    }

    case "model_request":
      return updateTurn(state, event.turnId, (t) => ({
        ...t,
        requests: [...t.requests, { attempt: event.attempt, messages: event.messages, settings: event.settings }],
      }));

    case "llm_token": {
      const turn = state.turns[event.turnId];
      if (!turn) return state;
      const isContent = event.channel === "content";
      const next = updateTurn(state, event.turnId, (t) =>
        isContent ? { ...t, output: t.output + event.text } : { ...t, reasoning: t.reasoning + event.text },
      );
      return updateAgent(next, turn.agentId, (a) => ({
        ...a,
        status: isContent ? (a.status === "tool_calling" ? a.status : "speaking") : "thinking",
        liveText: isContent ? a.liveText + event.text : a.liveText,
      }));
    }

    case "tool_called": {
      const turn = state.turns[event.turnId];
      if (!turn) return state;
      const next = updateTurn(state, event.turnId, (t) => ({
        ...t,
        toolCalls: [...t.toolCalls, { callId: event.callId, tool: event.tool, args: event.args }],
      }));
      return updateAgent(next, turn.agentId, (a) => ({
        ...a,
        status: "tool_calling",
        openToolCalls: [...a.openToolCalls, event.callId],
        activeTool: `${event.tool}(${event.args})`,
      }));
    }

    case "tool_result": {
      const turn = state.turns[event.turnId];
      if (!turn) return state;
      const next = updateTurn(state, event.turnId, (t) => ({
        ...t,
        toolCalls: t.toolCalls.map((c) =>
          c.callId === event.callId
            ? { ...c, result: event.result, error: event.error, durationMs: event.durationMs }
            : c,
        ),
      }));
      return updateAgent(next, turn.agentId, (a) => {
        const open = a.openToolCalls.filter((id) => id !== event.callId);
        return open.length > 0
          ? { ...a, openToolCalls: open }
          : { ...a, openToolCalls: open, status: "thinking", activeTool: null };
      });
    }

    case "turn_retried": {
      const turn = state.turns[event.turnId];
      if (!turn) return state;
      const next = updateTurn(state, event.turnId, (t) => ({
        ...t,
        output: "",
        reasoning: "",
        retries: [...t.retries, { reason: event.reason, attempt: event.attempt }],
      }));
      return updateAgent(next, turn.agentId, (a) => ({ ...a, status: "thinking", liveText: "" }));
    }

    case "agent_message": {
      const next = updateTurn(state, event.turnId, (t) => ({ ...t, message: event.text }));
      return updateAgent(
        {
          ...next,
          messages: [
            ...state.messages,
            {
              seq: event.seq,
              turnId: event.turnId,
              from: event.from,
              to: event.to,
              text: event.text,
              timestamp: event.timestamp,
            },
          ],
        },
        event.from,
        (a) => ({ ...a, liveText: event.text }),
      );
    }

    case "turn_finished": {
      const turn = state.turns[event.turnId];
      if (!turn) return state;
      const next = updateTurn(state, event.turnId, (t) => ({
        ...t,
        status: event.status,
        usage: event.usage,
        durationMs: event.durationMs,
        truncated: event.truncated,
        rawOutput: event.rawOutput,
        error: event.error,
      }));
      return updateAgent(next, turn.agentId, (a) => ({
        ...a,
        status: event.status === "error" ? "error" : "idle",
        tokens: a.tokens + event.usage.completionTokens,
        currentTurnId: null,
        openToolCalls: [],
        activeTool: null,
      }));
    }

    case "run_finished": {
      const agents: Record<string, AgentState> = {};
      for (const [id, a] of Object.entries(state.agents)) {
        agents[id] = a.status === "error" ? a : { ...a, status: "idle", currentTurnId: null, activeTool: null };
      }
      return {
        ...state,
        status: event.status,
        reason: event.reason,
        totals: event.totals,
        agents,
        finishedAt: event.timestamp,
      };
    }
  }
}

export function reduceEvents(events: readonly AgentEvent[]): RunState {
  return events.reduce(applyEvent, initialState);
}

export function isFinal(status: RunState["status"]): status is FinalStatus {
  return status !== "idle" && status !== "running";
}

/** The Turn still open (started but not finished), if any. */
export function openTurn(state: RunState): TurnState | null {
  for (let i = state.turnOrder.length - 1; i >= 0; i--) {
    const t = state.turns[state.turnOrder[i]];
    if (t.status === "running") return t;
  }
  return null;
}

export function totalUsage(state: RunState): TokenUsage {
  let promptTokens = 0;
  let completionTokens = 0;
  for (const id of state.turnOrder) {
    const u = state.turns[id].usage;
    if (u) {
      promptTokens += u.promptTokens;
      completionTokens += u.completionTokens;
    }
  }
  return { promptTokens, completionTokens };
}

// ---------- Loop rule (FR4.5) ----------

export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeArgs(args: string): string {
  try {
    return stableStringify(JSON.parse(args));
  } catch {
    return args.trim();
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export type LoopFinding = { agentId: string; turns: [number, number] };

/**
 * A Loop is the same agent, in two of its own consecutive finished Turns, producing
 * the same message (normalized) or the same tool call with the same arguments.
 */
export function detectLoop(state: RunState, agentId: string): LoopFinding | null {
  const own = state.turnOrder
    .map((id) => state.turns[id])
    .filter((t) => t.agentId === agentId && t.status === "ok");
  if (own.length < 2) return null;
  const [a, b] = own.slice(-2);

  const textA = a.message ?? a.output;
  const textB = b.message ?? b.output;
  if (textA.trim() !== "" && normalizeText(textA) === normalizeText(textB)) {
    return { agentId, turns: [a.turn, b.turn] };
  }

  for (const callA of a.toolCalls) {
    for (const callB of b.toolCalls) {
      if (callA.tool === callB.tool && normalizeArgs(callA.args) === normalizeArgs(callB.args)) {
        return { agentId, turns: [a.turn, b.turn] };
      }
    }
  }
  return null;
}

// ---------- helpers ----------

function updateAgent(state: RunState, agentId: string, fn: (a: AgentState) => AgentState): RunState {
  const agent = state.agents[agentId];
  if (!agent) return state;
  return { ...state, agents: { ...state.agents, [agentId]: fn(agent) } };
}

function updateTurn(state: RunState, turnId: string, fn: (t: TurnState) => TurnState): RunState {
  const turn = state.turns[turnId];
  if (!turn) return state;
  return { ...state, turns: { ...state.turns, [turnId]: fn(turn) } };
}
