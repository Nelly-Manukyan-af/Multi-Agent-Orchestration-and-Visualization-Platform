// The heart of the platform: every agent action becomes one of these events.
// The server saves them to the database and streams them to the browser.
// Live view, replay and metrics are all built from this one list.
//
// This is a first sketch. You will grow it as you build (weeks 4–6).

type BaseEvent = {
  id: string;
  runId: string; // which run this belongs to
  timestamp: number; // ms since epoch
};

export type AgentEvent = BaseEvent &
  (
    | { type: "llm_token"; agentId: string; text: string } // one small piece of a reply, as it arrives
    | { type: "run_started"; task: string; agentIds: string[] }
    | { type: "agent_started"; agentId: string }
    | { type: "message_sent"; fromAgentId: string; toAgentId: string | "all"; content: string }
    | { type: "tool_called"; agentId: string; tool: string; args: Record<string, unknown> }
    | { type: "tool_result"; agentId: string; tool: string; output: string }
    | {
        type: "llm_response";
        agentId: string;
        promptTokens: number;
        outputTokens: number;
        durationMs: number;
      }
    | { type: "agent_finished"; agentId: string; result: string }
    | { type: "run_finished"; status: "completed" | "failed" | "stopped" }
  );

export type Agent = {
  id: string;
  name: string; // "Researcher"
  role: string; // the system prompt: who this agent is and how it behaves
  model: string; // "qwen3:8b"
  tools: string[]; // names of tools it may call
};
