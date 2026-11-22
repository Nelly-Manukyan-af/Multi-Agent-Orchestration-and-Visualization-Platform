import type { ChatOptions, ChatResult, Message, ToolDefinition } from "./ollama.ts";

type StreamChunk = {
  error?: unknown;
  choices?: { delta?: { content?: string; refusal?: string; tool_calls?: unknown[] }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export async function chat(
  messages: Message[],
  tools: ToolDefinition[] | undefined,
  onToken: ((text: string) => void | Promise<void>) | undefined,
  options: ChatOptions,
): Promise<ChatResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Set GEMINI_API_KEY on the server to use Gemini");
  if (tools?.length || messages.some((message) => message.role === "tool" || (message.role === "assistant" && message.tool_calls?.length))) {
    throw new Error("Gemini tool execution is not implemented yet");
  }

  const startedAt = performance.now();
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: options.signal,
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        reasoning_effort: "low",
        stream: true,
        stream_options: { include_usage: true },
      }),
    });
    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      const hint = response.status >= 500
        ? "The service is temporarily unavailable. Try again shortly or choose another model."
        : response.status === 429
        ? "The rate limit or quota was exceeded. Try later or check your Gemini quota."
        : response.status === 404
        ? "Check that the configured model exists and is available to your key."
        : response.status === 401 || response.status === 403
        ? "Check your Gemini API key and access permissions."
        : "Check the request parameters.";
      const detail = typeof body?.error?.message === "string"
        ? ` ${body.error.message.replaceAll(apiKey, "[REDACTED]").slice(0, 200)}`
        : "";
      throw new Error(`Gemini returned ${response.status}. ${hint}${detail}`);
    }

    let content = "";
    let promptTokens = 0;
    let outputTokens = 0;
    let finishReason: string | null = null;
    let done = false;
    let buffer = "";
    let dataLines: string[] = [];
    const decoder = new TextDecoder();

    const consumeLine = async (line: string) => {
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
        return;
      }
      if (line !== "" || dataLines.length === 0) return;
      const data = dataLines.join("\n");
      dataLines = [];
      if (data === "[DONE]") {
        done = true;
        return;
      }
      const chunk = JSON.parse(data) as StreamChunk;
      if (chunk.error) throw new Error("Gemini stream reported an error");
      const choice = chunk.choices?.[0];
      if (choice?.delta?.refusal || choice?.finish_reason === "content_filter") {
        throw new Error("Gemini declined this response");
      }
      if (choice?.delta?.tool_calls?.length) throw new Error("Gemini tool execution is not implemented yet");
      const piece = choice?.delta?.content;
      if (piece) {
        content += piece;
        await onToken?.(piece);
      }
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens ?? promptTokens;
        outputTokens = chunk.usage.completion_tokens ?? outputTokens;
      }
    };

    for await (const bytes of response.body) {
      buffer += decoder.decode(bytes, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) await consumeLine(line);
    }
    await consumeLine((buffer + decoder.decode()).replace(/\r$/, ""));
    await consumeLine("");
    if (!done || !finishReason) throw new Error("Gemini stream ended before completion");
    if (finishReason !== "stop" && finishReason !== "length") {
      throw new Error("Gemini ended without a text answer");
    }

    return {
      message: { role: "assistant", content },
      promptTokens,
      outputTokens,
      durationMs: Math.round(performance.now() - startedAt),
      truncated: finishReason === "length",
    };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    const message = error instanceof Error ? error.message : "Gemini request failed";
    if (error instanceof Error && !message.includes(apiKey)) throw error;
    throw new Error(message.replaceAll(apiKey, "[REDACTED]"));
  }
}
