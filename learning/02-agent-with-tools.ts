// Week 2: an agent = an LLM in a loop that can use tools.
// Run: npm run agent
//      npm run agent -- "your own task here"
//
// The loop:
//   1. Send the conversation + the list of tools to the model.
//   2. If the model asks to call tools, run them and add the results to the conversation.
//   3. Repeat until the model answers without calling a tool.
//
// Notice the printed lines starting with [event]. Later, your platform will send exactly
// these events to the browser and draw them as a graph. This file is the seed of the thesis.

import { chat, type Message, type ToolDefinition } from "./ollama.ts";
import {appendFileSync} from "node:fs";

// ---- Tools: plain functions the model is allowed to call ----

const tools: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "calculate",
      description: "Do exact arithmetic on two numbers. Use this instead of doing maths yourself.",
      parameters: {
        type: "object",
        properties: {
          a: { type: "number", description: "First number" },
          b: { type: "number", description: "Second number" },
          operation: {
            type: "string",
            description: "What to do",
            enum: ["add", "subtract", "multiply", "divide"],
          },
        },
        required: ["a", "b", "operation"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_date",
      description: "Get today's date. Use this whenever the task depends on the current date.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "days_between",
      description: "Count the days from one date to another. Dates are YYYY-MM-DD.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Start date, YYYY-MM-DD" },
          to: { type: "string", description: "End date, YYYY-MM-DD" },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_note",
      description: "Save a short note to a file so it is kept after the conversation ends. Use this when the user asks you  to remember or save something",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to save to a file" },
        },
        required: ["text"],
      },
    },
  },
];

function runTool(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "calculate": {
      const a = Number(args.a);
      const b = Number(args.b);
      const results: Record<string, number> = {
        add: a + b,
        subtract: a - b,
        multiply: a * b,
        divide: a / b,
      };
      const value = results[String(args.operation)];
      return value === undefined ? `Unknown operation: ${args.operation}` : String(value);
    }
    case "get_current_date":
      return new Date().toISOString().slice(0, 10);
    case "days_between": {
      const days = (Date.parse(String(args.to)) - Date.parse(String(args.from))) / 86_400_000;
      return Number.isNaN(days) ? "Invalid date: use YYYY-MM-DD" : String(Math.round(days));
    }
    case "save_note": {
      const text = String(args.text ?? "").trim();
      if (!text) return "Nothing saved: the note text was empty";
      const line = `- ${new Date().toISOString().slice(0, 10)}: ${text}\n`;
      appendFileSync("notes.md", line);
      return `Saved note: "${text}"`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// ---- The agent loop ----

const task =
  process.argv[2] ??
  "How many days are left until December 1, 2026? Then multiply that number by 24 to get the hours.";

const messages: Message[] = [
  {
    role: "system",
    content:
      "You are a careful assistant. Use the tools for dates and arithmetic. " +
      "When you have the final answer, reply in one or two sentences.",
  },
  { role: "user", content: task },
];

const MAX_STEPS = 8; // safety limit: small models sometimes loop forever

console.log(`[event] agent_started  task="${task}"`);

for (let step = 1; step <= MAX_STEPS; step++) {
  // Print each piece of the answer the moment it arrives (no new line, so the words join up).
  const { message, promptTokens, outputTokens, durationMs } = await chat(messages, tools, (piece) =>
    process.stdout.write(piece),
  );
  if (message.content) process.stdout.write("\n");
  messages.push(message);
  console.log(`[event] llm_response   step=${step} tokens=${promptTokens}+${outputTokens} ${durationMs}ms`);

  if (!message.tool_calls?.length) {
    // Small models sometimes reply with nothing at all. Ask again instead of stopping.
    if (!message.content.trim()) {
      console.log(`[event] empty_reply    asking the model to answer`);
      messages.push({ role: "user", content: "Please give your final answer now." });
      continue;
    }
    console.log(`[event] agent_finished`); // the answer was already printed while streaming
    process.exit(0);
  }

  for (const call of message.tool_calls) {
    const { name, arguments: args } = call.function;
    console.log(`[event] tool_called    ${name}(${JSON.stringify(args)})`);
    const output = runTool(name, args);
    console.log(`[event] tool_result    ${name} -> ${output}`);
    messages.push({ role: "tool", content: output, tool_name: name });
  }
}

console.log(`[event] agent_stopped  reached ${MAX_STEPS} steps without a final answer`);
