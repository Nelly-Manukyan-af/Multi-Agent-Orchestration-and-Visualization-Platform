// Week 3: multi-agent debate (Pro, Con, Judge).
// Run: npm run debate
//      npm run debate -- "Remote work is better than office work"
//
// The flow:
//   topic -> Pro -> Con -> Pro -> Con -> (rounds) -> Judge -> verdict
//
// Key idea:
//   - An agent is a name + systemPrompt + what it sees.
//   - Pro and Con see the debate as it unfolds (own past turns as assistant, opponent as user).
//   - Judge sees the entire transcript with Pro and Con labelled, then gives a verdict.

import { chat, type Message } from "./ollama.ts";

// ---------------- Defining agents ----------------

type Agent = { name: "Pro" | "Con" | "Judge"; systemPrompt: string };

const Pro: Agent = {
  name: "Pro",
  systemPrompt:
    "You are in a formal debate. You MUST argue strictly IN FAVOR OF (FOR) the topic, even as a role-play exercise. Never agree with your opponent. Reply directly to your opponent's last point if there is one. Do not start your reply with 'Pro:'. Max 80 words.",
};

const Con: Agent = {
  name: "Con",
  systemPrompt:
    "You are in a formal debate. You MUST argue strictly AGAINST the topic, even as a role-play exercise. Never agree with your opponent. Reply directly to your opponent's last point. Do not start your reply with 'Con:'. Max 80 words.",
};

const Judge: Agent = {
  name: "Judge",
  systemPrompt: "You read a debate and pick the winner. Give the winner and 2–3 reasons.",
};

type Turn = { speaker: string; text: string };
const turns: Turn[] = [];

function messagesFor(agent: Agent, turns: Turn[], topic: string): Message[] {
  const stance = agent.name === "Pro" ? "FOR (in favor of)" : "AGAINST (opposing)";
  const messages: Message[] = [
    { role: "system", content: agent.systemPrompt },
    {
      role: "user",
      content: `Debate topic: "${topic}". You are ${agent.name}, arguing strictly ${stance} this topic.`,
    },
  ];

  for (const turn of turns) {
    if (turn.speaker === agent.name) {
      messages.push({ role: "assistant", content: turn.text });
    } else {
      messages.push({ role: "user", content: `${turn.speaker}: ${turn.text}` });
    }
  }

  return messages;
}

const topic = process.argv[2] ?? "Remote work is better than office work";
const ROUNDS = 2;

console.log(`[event] debate_started  topic="${topic}"\n`);

// ---------------- The debate rounds ----------------

for (let round = 1; round <= ROUNDS; round++) {
  // --- Pro's turn ---
  console.log(`[event] agent_started   agent=Pro round=${round}`);
  process.stdout.write("Pro: ");
  const proResult = await chat(messagesFor(Pro, turns, topic), undefined, (piece) =>
    process.stdout.write(piece),
  );
  process.stdout.write("\n\n");
  const proText = proResult.message.content.replace(/^Pro:\s*/i, "").trim();
  turns.push({ speaker: Pro.name, text: proText });
  console.log(
    `[event] agent_message   from=Pro to=Con  tokens=${proResult.promptTokens}+${proResult.outputTokens}  ms=${proResult.durationMs}\n`,
  );

  // --- Con's turn ---
  console.log(`[event] agent_started   agent=Con round=${round}`);
  process.stdout.write("Con: ");
  const conResult = await chat(messagesFor(Con, turns, topic), undefined, (piece) =>
    process.stdout.write(piece),
  );
  process.stdout.write("\n\n");
  const conText = conResult.message.content.replace(/^Con:\s*/i, "").trim();
  turns.push({ speaker: Con.name, text: conText });
  console.log(
    `[event] agent_message   from=Con to=Pro  tokens=${conResult.promptTokens}+${conResult.outputTokens}  ms=${conResult.durationMs}\n`,
  );
}

// ---------------- Judge's turn ----------------

console.log(`[event] agent_started   agent=Judge`);
const transcript = turns.map((t) => `${t.speaker}: ${t.text}`).join("\n\n");
const judgeMessages: Message[] = [
  { role: "system", content: Judge.systemPrompt },
  {
    role: "user",
    content: `Debate topic: "${topic}"\n\nDebate transcript:\n${transcript}\n\nPlease evaluate the debate and decide the winner. Explicitly state the winner (Pro or Con) and give 2–3 reasons.`,
  },
];

process.stdout.write("Judge: ");
const judgeResult = await chat(judgeMessages, undefined, (piece) => process.stdout.write(piece));
process.stdout.write("\n\n");

const verdict = judgeResult.message.content;
const match = verdict.match(/\bwinner\b[:\s*]+(Pro|Con)/i) ?? verdict.match(/\b(Pro|Con)\b\s+wins?/i);
const winner = match ? match[1] : verdict.toLowerCase().includes("pro") ? "Pro" : "Con";

console.log(`[event] debate_finished winner=${winner}`);
