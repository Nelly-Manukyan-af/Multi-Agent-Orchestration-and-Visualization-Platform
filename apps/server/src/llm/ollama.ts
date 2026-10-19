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

export async function chat(
    messages: Message[],
    tools?: ToolDefinition[],
    onToken?: (text: string) => void, // called with each new piece of text as it arrives
): Promise<ChatResult> {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: MODEL,
            messages,
            tools,
            stream: true, // send the answer in small pieces, one JSON object per line
            think: false, // Qwen 3 can "think" before answering; off = faster
            options: { temperature: 0.7 }, // 0 = predictable, higher = more creative
        }),
    });

    if (!response.ok || !response.body) {
        throw new Error(`Ollama returned ${response.status}: ${await response.text()}`);
    }

    let content = ""; // the full answer, built from the pieces
    const toolCalls: ToolCall[] = [];
    let final: StreamChunk | undefined; // the last piece (done: true) carries the token counts
    let buffer = ""; // network chunks can end in the middle of a line, so keep the rest here
    const decoder = new TextDecoder();

    for await (const bytes of response.body) {
        buffer += decoder.decode(bytes, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // the last line may be unfinished: wait for the next chunk

        for (const line of lines) {
            if (!line.trim()) continue;
            const chunk: StreamChunk = JSON.parse(line);
            const piece = chunk.message?.content ?? "";
            if (piece) {
                content += piece;
                onToken?.(piece);
            }
            if (chunk.message?.tool_calls) toolCalls.push(...chunk.message.tool_calls); // tool calls arrive whole
            if (chunk.done) final = chunk;
        }
    }

    return {
        message: { role: "assistant", content, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
        promptTokens: final?.prompt_eval_count ?? 0,
        outputTokens: final?.eval_count ?? 0,
        durationMs: Math.round((final?.total_duration ?? 0) / 1e6),
    };
}

// One line of Ollama's streamed reply.
type StreamChunk = {
    message?: { content?: string; tool_calls?: ToolCall[] };
    done: boolean;
    prompt_eval_count?: number;
    eval_count?: number;
    total_duration?: number; // nanoseconds
};
