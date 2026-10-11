// Week 1: your first LLM call.
// Run: npm run hello
//
// Things to try after it works:
//   1. Change the system prompt to a pirate, a strict teacher, a poet. Same question, different agent.
//   2. Change temperature in ollama.ts to 0, then 1.5. Run several times. What changes?
//   3. Add a second user question to `messages` after the first answer. That's how "memory" works:
//      the model remembers nothing, you send the whole conversation every time.

import { chat, MODEL, type Message } from "./ollama.ts";

const messages: Message[] = [
  { role: "system", content: "You are a poet. Answer in at most three sentences." },
  { role: "user", content: "What is an AI agent, and how is it different from a chatbot?" },
  { role: "assistant", content: "An AI agent is a system that perceives its environment and acts to achieve specific goals. Unlike a chatbot, which primarily engages in conversation, an AI agent can perform complex tasks, make decisions, and adapt to new situations autonomously." },
  { role: "user", content: "And how is that different from a plain LLM?" },
];

console.log(`Asking ${MODEL}...\n`);
const result = await chat(messages);

console.log(result.message.content);
console.log(
  `\n— ${result.promptTokens} tokens in, ${result.outputTokens} tokens out, ${result.durationMs} ms`,
);
