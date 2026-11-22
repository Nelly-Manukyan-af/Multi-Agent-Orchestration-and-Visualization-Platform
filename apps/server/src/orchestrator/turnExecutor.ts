// The one turn executor (PROJECT.md §6.1 #10): model_request, streaming, retries
// (FR4.6) and Stop (FR4.2) are implemented once here. Patterns only decide who
// speaks next and whether the Run is finished.

import type { AgentSnapshot, ChatMessage, NewEvent, RetryReason, TurnStatus } from "@agent-platform/shared";
import { chat, type Message } from "../llm/client.ts";

export type TurnContext = {
  emit: (event: NewEvent) => void;
  signal: AbortSignal;
};

export type TurnPlan = {
  agent: AgentSnapshot;
  messages: ChatMessage[];
  to: string[]; // recipients of the Message; [] = final output
  delegationCallId?: string;
  /** Clean up the model's text before it becomes a Message (raw output is kept). */
  postprocess?: (text: string) => string;
};

export type TurnResult = { turnId: string; status: TurnStatus; error?: string };

const CONNECTION_RETRY_MS = 1000;
const EMPTY_REPLY_CORRECTION = "Your previous reply was empty. Please answer now.";

export async function executeTurn(ctx: TurnContext, plan: TurnPlan, turnNumber: number): Promise<TurnResult> {
  const { emit, signal } = ctx;
  const { agent } = plan;
  const turnId = crypto.randomUUID();
  const startedAt = Date.now();
  const settings = { model: agent.model, provider: agent.provider, temperature: agent.temperature, maxTokens: agent.maxTokens };

  emit({ type: "turn_started", turnId, agentId: agent.id, turn: turnNumber, delegationCallId: plan.delegationCallId });

  let messages = plan.messages;
  let attempt = 1;
  let retried = false;
  let promptTokens = 0;
  let completionTokens = 0;
  let partial = "";

  const finish = (status: TurnStatus, rawOutput: string, truncated = false, error?: string): TurnResult => {
    emit({
      type: "turn_finished",
      turnId,
      status,
      truncated,
      usage: { promptTokens, completionTokens },
      durationMs: Date.now() - startedAt,
      rawOutput,
      error,
    });
    return { turnId, status, error };
  };

  const retry = (reason: RetryReason) => {
    retried = true;
    attempt++;
    emit({ type: "turn_retried", turnId, reason, attempt });
  };

  while (true) {
    emit({ type: "model_request", turnId, attempt, messages, settings });
    partial = "";

    try {
      const result = await chat(
        toModelMessages(messages),
        undefined,
        (text) => {
          partial += text;
          emit({ type: "llm_token", turnId, text, channel: "content" });
        },
        { ...settings, signal },
      );
      promptTokens += result.promptTokens;
      completionTokens += result.outputTokens;
      const raw = result.message.content;
      const text = plan.postprocess ? plan.postprocess(raw) : raw.trim();

      if (text.trim() === "") {
        if (retried) return finish("error", raw, false, "Empty reply after retry");
        retry("empty");
        messages = [...messages, { role: "assistant", content: "" }, { role: "user", content: EMPTY_REPLY_CORRECTION }];
        continue;
      }

      emit({ type: "agent_message", turnId, from: agent.id, to: plan.to, text });
      return finish("ok", raw, result.truncated);
    } catch (err) {
      if (signal.aborted) return finish("aborted", partial);
      const message = errorText(err);
      if (retried) return finish("error", partial, false, message);
      retry("connection");
      try {
        await sleep(CONNECTION_RETRY_MS, signal);
      } catch {
        return finish("aborted", partial);
      }
    }
  }
}

function toModelMessages(messages: ChatMessage[]): Message[] {
  return messages.map((m) =>
    m.role === "tool" ? { role: "tool", content: m.content, tool_name: m.toolCallId } : { role: m.role, content: m.content },
  );
}

/** Shortened error text. Phase 3 also redacts the API key here (FR1.5). */
function errorText(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
