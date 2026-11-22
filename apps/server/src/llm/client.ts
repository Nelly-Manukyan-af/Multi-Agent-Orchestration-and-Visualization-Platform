import { chat as ollamaChat, type ChatOptions, type ChatResult, type Message, type ToolDefinition } from "./ollama.ts";
import { chat as geminiChat } from "./gemini.ts";
import type { ModelOption, ModelProvider } from "@agent-platform/shared";

export type { Message } from "./ollama.ts";

const configuredProvider = process.env.MODEL_PROVIDER ?? "ollama";
if (configuredProvider !== "ollama" && configuredProvider !== "gemini") {
  throw new Error("MODEL_PROVIDER must be ollama or gemini");
}
if (configuredProvider === "gemini" && !process.env.GEMINI_API_KEY?.trim()) {
  throw new Error("Set GEMINI_API_KEY on the server when MODEL_PROVIDER=gemini");
}

export const DEFAULT_PROVIDER: ModelProvider = configuredProvider;

export function defaultModel(provider: ModelProvider): string {
  const explicit = provider === "gemini" ? process.env.GEMINI_MODEL : process.env.OLLAMA_MODEL;
  return explicit?.trim() || (provider === DEFAULT_PROVIDER ? process.env.MODEL?.trim() : "")
    || (provider === "gemini" ? "gemini-3.5-flash-lite" : "qwen3:8b");
}

export function maxTokensFor(provider: ModelProvider): number {
  return provider === "gemini" ? 4096 : 512;
}

export const MODEL = defaultModel(DEFAULT_PROVIDER);

export function chat(
  messages: Message[],
  tools?: ToolDefinition[],
  onToken?: (text: string) => void | Promise<void>,
  options: ChatOptions & { provider?: ModelProvider } = {},
): Promise<ChatResult> {
  const provider = options.provider ?? DEFAULT_PROVIDER;
  const settings = { ...options, model: options.model || defaultModel(provider) };
  return provider === "gemini"
    ? geminiChat(messages, tools, onToken, settings)
    : ollamaChat(messages, tools, onToken, settings);
}

export async function listModels(): Promise<ModelOption[]> {
  let ollamaModels = [defaultModel("ollama")];
  try {
    const response = await fetch(`${process.env.OLLAMA_URL ?? "http://localhost:11434"}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      const data = (await response.json()) as { models?: { name: string }[] };
      ollamaModels = data.models?.map((model) => model.name) ?? ollamaModels;
    }
  } catch {
    ollamaModels = [defaultModel("ollama")];
  }
  const models: ModelOption[] = ollamaModels.map((model) => ({ provider: "ollama", model }));
  if (process.env.GEMINI_API_KEY?.trim()) models.push({ provider: "gemini", model: defaultModel("gemini") });
  return models;
}
