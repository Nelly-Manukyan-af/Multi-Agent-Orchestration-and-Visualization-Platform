// A tiny client for Ollama's chat API, written by hand so you can see
// exactly what goes over the wire. Docs: https://docs.ollama.com/api/chat

export const MODEL = process.env.MODEL ?? "qwen3:8b";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";

// One message in a conversation. The model only ever sees this list.
export type Message =
  | { role: "system"; content: string } // instructions: who the agent is
  | { role: "user"; content: string } // the task or question
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] } // the model's reply
  | { role: "tool"; content: string; tool_name: string }; // a tool's result, sent back to the model

export type ToolCall = {
  function: { name: string; arguments: Record<string, unknown> };
};

// How a tool is described to the model (JSON Schema for its arguments).
export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  };
};

export type ChatResult = {
  message: { role: "assistant"; content: string; tool_calls?: ToolCall[] };
  promptTokens: number; // tokens the model read
  outputTokens: number; // tokens the model wrote
  durationMs: number;
};

export async function chat(messages: Message[], tools?: ToolDefinition[]): Promise<ChatResult> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      stream: false, // wait for the whole answer (streaming comes later)
      think: false, // Qwen 3 can "think" before answering; off = faster
      options: { temperature: 0.7 }, // 0 = predictable, higher = more creative
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return {
    message: data.message,
    promptTokens: data.prompt_eval_count ?? 0,
    outputTokens: data.eval_count ?? 0,
    durationMs: Math.round((data.total_duration ?? 0) / 1e6),
  };
}
