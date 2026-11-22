// The event catalog (PROJECT.md §8, ADR-0002).
// Every Run is an append-only list of these Events. The server stores them,
// streams them to the browser, and Replay rebuilds a Run from them.

export type FinalStatus = "completed" | "stopped" | "failed" | "loop_detected" | "turn_limit_reached";
export type RunStatus = "running" | FinalStatus;

export type Pattern = "sequential" | "manager_workers" | "group_discussion";

/** One Team Member as frozen at Run start (FR2.3). Never contains an API key. */
export type AgentSnapshot = {
  id: string; // role-slot id within the run, e.g. "pro"
  name: string;
  role: string; // "Pro", "Con", "Judge", "Manager", ...
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
};

/** A message exactly as sent to the model. */
export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "tool"; content: string; toolCallId: string };

export type ModelSettings = { model: string; temperature: number; maxTokens: number };

export type TokenUsage = { promptTokens: number; completionTokens: number };

export type TurnStatus = "ok" | "error" | "aborted";
export type RetryReason = "empty" | "malformed" | "connection";

type EventBase = {
  runId: string;
  seq: number; // 1, 2, 3 ... per Run, assigned by the event store
  timestamp: number; // ms since epoch, assigned by the event store
};

export type AgentEvent = EventBase &
  (
    | {
        type: "run_started";
        snapshot: AgentSnapshot[];
        task: string;
        teamName: string;
        pattern: Pattern;
        topology: { from: string; to: string }[];
        turnLimit: number;
        rounds?: number;
      }
    | { type: "turn_started"; turnId: string; agentId: string; turn: number; delegationCallId?: string }
    | { type: "model_request"; turnId: string; attempt: number; messages: ChatMessage[]; settings: ModelSettings }
    | { type: "llm_token"; turnId: string; text: string; channel: "content" | "reasoning" }
    | { type: "tool_called"; turnId: string; callId: string; tool: string; args: string }
    | { type: "tool_result"; turnId: string; callId: string; result?: string; error?: string; durationMs: number }
    | { type: "turn_retried"; turnId: string; reason: RetryReason; attempt: number }
    | { type: "agent_message"; turnId: string; from: string; to: string[]; text: string }
    | {
        type: "turn_finished";
        turnId: string;
        status: TurnStatus;
        truncated: boolean;
        usage: TokenUsage;
        durationMs: number;
        rawOutput: string;
        error?: string;
      }
    | {
        type: "run_finished";
        status: FinalStatus;
        reason: string;
        totals: TokenUsage & { turns: number; durationMs: number };
      }
  );

export type AgentEventType = AgentEvent["type"];

/** An event as produced by the orchestrator, before the store assigns runId/seq/timestamp. */
export type NewEvent = DistributiveOmit<AgentEvent, "runId" | "seq" | "timestamp">;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

// ---------- REST / WebSocket contract ----------

export type AgentRecord = {
  id: string;
  name: string;
  role: string; // the system prompt
  model: string;
  createdAt: number;
};

export type RunRecord = {
  id: string;
  teamName: string;
  pattern: Pattern;
  task: string;
  status: RunStatus;
  startedAt: number;
  finishedAt: number | null;
  totalTokens: number;
  durationMs: number | null;
};

export type AgentSelection = {
  proId?: string;
  conId?: string;
  judgeId?: string;
};

/** Body of POST /runs. */
export type StartRunRequest = AgentSelection & {
  task: string;
  turnLimit?: number; // 1–50, default 10
  rounds?: number; // Group Discussion rounds, default 3
};

/** Messages the browser sends over /ws (FR7.3). */
export type ClientMessage = { type: "subscribe"; runId: string; afterSeq: number };

/** Messages the server sends over /ws besides events. */
export type ServerMessage = { type: "event"; event: AgentEvent } | { type: "error"; runId: string; message: string };
