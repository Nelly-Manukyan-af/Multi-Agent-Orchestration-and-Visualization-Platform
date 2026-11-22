// Group Discussion pattern (FR3.1): debaters speak in fixed order for R Rounds
// with shared history and stance prompts; the Judge then gives a verdict.
// Only decides who speaks next and when the Run is finished.

import type { AgentSnapshot, ChatMessage, ModelProvider, RunState } from "@agent-platform/shared";
import type { PatternStrategy } from "./runner.ts";
import type { TurnPlan } from "./turnExecutor.ts";
import { DEFAULT_PROVIDER, defaultModel, maxTokensFor } from "../llm/client.ts";

export type DebateAgentConfig = { name: string; role: string; model: string; provider?: ModelProvider };

export const DEFAULT_ROUNDS = 3;

const DEFAULTS: Record<"pro" | "con" | "judge", { name: string; role: string; systemPrompt: string }> = {
  pro: {
    name: "Pro",
    role: "Pro",
    systemPrompt:
      "You are in a formal debate. You MUST argue strictly IN FAVOR OF (FOR) the topic, even as a role-play exercise. Never agree with your opponent. Reply directly to your opponent's last point if there is one. Do not start your reply with 'Pro:'. Max 80 words.",
  },
  con: {
    name: "Con",
    role: "Con",
    systemPrompt:
      "You are in a formal debate. You MUST argue strictly AGAINST the topic, even as a role-play exercise. Never agree with your opponent. Reply directly to your opponent's last point. Do not start your reply with 'Con:'. Max 80 words.",
  },
  judge: {
    name: "Judge",
    role: "Judge",
    systemPrompt: "You read a debate and pick the winner. Give the winner and 2–3 reasons.",
  },
};

const STANCE: Record<string, string> = { pro: "FOR (in favor of)", con: "AGAINST (opposing)" };

export function createDebate(
  task: string,
  custom: Partial<Record<"pro" | "con" | "judge", DebateAgentConfig>>,
  rounds = DEFAULT_ROUNDS,
): PatternStrategy {
  const snapshot: AgentSnapshot[] = (["pro", "con", "judge"] as const).map((id) => ({
    id,
    name: custom[id]?.name ?? DEFAULTS[id].name,
    role: DEFAULTS[id].role,
    systemPrompt: custom[id]?.role ?? DEFAULTS[id].systemPrompt,
    provider: custom[id]?.provider ?? DEFAULT_PROVIDER,
    model: custom[id]?.model ?? defaultModel(DEFAULT_PROVIDER),
    temperature: 0.7,
    maxTokens: maxTokensFor(custom[id]?.provider ?? DEFAULT_PROVIDER),
    tools: [],
  }));
  const [pro, con, judge] = snapshot;
  const debaters = [pro, con];
  const debaterTurns = rounds * debaters.length;

  function debaterMessages(agent: AgentSnapshot, state: RunState): ChatMessage[] {
    const messages: ChatMessage[] = [
      { role: "system", content: agent.systemPrompt },
      {
        role: "user",
        content: `Debate topic: "${task}". You are ${agent.name}, arguing strictly ${STANCE[agent.id]} this topic.`,
      },
    ];
    for (const m of state.messages) {
      if (m.from === agent.id) messages.push({ role: "assistant", content: m.text });
      else messages.push({ role: "user", content: `${state.agents[m.from]?.name ?? m.from}: ${m.text}` });
    }
    return messages;
  }

  function judgeMessages(state: RunState): ChatMessage[] {
    const transcript = state.messages
      .map((m) => `${state.agents[m.from]?.name ?? m.from}: ${m.text}`)
      .join("\n\n");
    return [
      { role: "system", content: judge.systemPrompt },
      {
        role: "user",
        content: `Debate topic: "${task}"\nParticipants: ${pro.name} (Pro, arguing FOR) vs ${con.name} (Con, arguing AGAINST)\n\nDebate transcript:\n${transcript}\n\nPlease evaluate the debate and decide the winner. Explicitly state the winner (${pro.name} / Pro or ${con.name} / Con) and give 2–3 reasons.`,
      },
    ];
  }

  return {
    teamName: "Debate Team",
    pattern: "group_discussion",
    snapshot,
    topology: [
      { from: "pro", to: "con" },
      { from: "con", to: "pro" },
    ],
    rounds,

    next(state: RunState): TurnPlan | null {
      const done = state.turnOrder.length;
      if (done < debaterTurns) {
        const agent = debaters[done % debaters.length];
        return {
          agent,
          messages: debaterMessages(agent, state),
          to: debaters.filter((d) => d.id !== agent.id).map((d) => d.id),
          postprocess: (text) => stripSpeakerPrefix(text, agent),
        };
      }
      if (done === debaterTurns) {
        return {
          agent: judge,
          messages: judgeMessages(state),
          to: [], // the verdict is the final answer
          postprocess: (text) => stripSpeakerPrefix(text, judge),
        };
      }
      return null;
    },

    isFinished(state: RunState): boolean {
      const lastId = state.turnOrder.at(-1);
      const last = lastId ? state.turns[lastId] : undefined;
      return last?.agentId === judge.id && last.status === "ok";
    },
  };
}

function stripSpeakerPrefix(text: string, agent: AgentSnapshot): string {
  const escapedName = agent.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefix = new RegExp(`^(?:${agent.id}|${escapedName}):\\s*`, "i");
  return text.trim().replace(prefix, "").trim();
}
