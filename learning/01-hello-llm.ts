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
  { role: "system", content: "You are a friendly tutor. Answer in at most three sentences." },
  { role: "user", content: "What is an AI agent, and how is it different from a chatbot?" },
];

console.log(`Asking ${MODEL}...\n`);
const result = await chat(messages);

console.log(result.message.content);
console.log(
  `\n— ${result.promptTokens} tokens in, ${result.outputTokens} tokens out, ${result.durationMs} ms`,
);
