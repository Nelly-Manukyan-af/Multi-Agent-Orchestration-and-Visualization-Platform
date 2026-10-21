import type { AgentEvent } from "@agent-platform/shared";

export type AgentStatus = "idle" | "thinking" | "done" | "error";

export type AgentState = {
  status: AgentStatus;
  liveText: string;
  tokens: number;
};

export type RunState = {
  status: "idle" | "running" | "completed" | "failed" | "stopped";
  agents: Record<string, AgentState>;
  messages: { from: string; to: string; content: string; timestamp: number }[];
  activeEdge: { from: string; to: string } | null; // the message being sent right now
};

export const initialState: RunState = {
  status: "idle",
  agents: {},
  messages: [],
  activeEdge: null,
};

export function applyEvent(state: RunState, event: AgentEvent): RunState {
  switch (event.type) {
    case "run_started": {
      const agents: Record<string, AgentState> = {};
      for (const id of event.agentIds) {
        agents[id] = { status: "idle", liveText: "", tokens: 0 };
      }
      return {
        ...state,
        status: "running",
        agents,
        messages: [],
        activeEdge: null,
      };
    }

    case "agent_started": {
      const current = state.agents[event.agentId];
      return {
        ...state,
        agents: {
          ...state.agents,
          [event.agentId]: {
            ...current,
            status: "thinking",
            liveText: "", // clear previous turn text
          },
        },
      };
    }

    case "llm_token": {
      const current = state.agents[event.agentId];
      if (!current) return state;
      return {
        ...state,
        agents: {
          ...state.agents,
          [event.agentId]: {
            ...current,
            liveText: current.liveText + event.text,
          },
        },
      };
    }

    case "llm_response": {
      const current = state.agents[event.agentId];
      if (!current) return state;
      return {
        ...state,
        agents: {
          ...state.agents,
          [event.agentId]: {
            ...current,
            tokens: current.tokens + event.outputTokens,
          },
        },
      };
    }

    case "message_sent": {
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            from: event.fromAgentId,
            to: event.toAgentId,
            content: event.content,
            timestamp: event.timestamp,
          },
        ],
        activeEdge: event.toAgentId === "all" ? null : { from: event.fromAgentId, to: event.toAgentId },
      };
    }

    case "agent_finished": {
      const current = state.agents[event.agentId];
      if (!current) return state;
      return {
        ...state,
        agents: {
          ...state.agents,
          [event.agentId]: {
            ...current,
            status: "done",
          },
        },
      };
    }

    case "run_finished": {
      const agents = { ...state.agents };
      if (event.status === "failed") {
        for (const [id, agent] of Object.entries(agents)) {
          if (agent.status === "thinking") {
            agents[id] = { ...agent, status: "error" };
          }
        }
      }
      return {
        ...state,
        status: event.status,
        agents,
        activeEdge: null,
      };
    }

    default:
      return state;
  }
}
