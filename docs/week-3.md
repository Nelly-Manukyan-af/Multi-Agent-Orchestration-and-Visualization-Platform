# Week 3 · Oct 26 – Nov 1 · Many agents, and what exists already

**Goal:** go from one agent to a team of agents, and learn what other people have already built,
so the thesis can explain what your platform does that the others don't.

**Order:** papers → tools → debate → literature review.
The papers help you understand the tools, and the review is easier to write while your notes are fresh.

| Day | Work |
| --- | --- |
| Mon | Task 1: papers |
| Tue–Wed | Task 2: try the tools |
| Thu–Fri | Task 3: build the debate |
| Sat–Sun | Task 4: literature review draft |

---

## Task 1 · Skim five papers (about 1 day)

Don't read every page. For each paper: **abstract → figures → one example → conclusion**. About 1–2 hours each.

| Paper | In one sentence | Look for |
| --- | --- | --- |
| [AutoGen](https://arxiv.org/abs/2308.08155) (Microsoft, 2023) | Agents solve tasks by chatting with each other; one can run code | "Conversable agents", group chat with a manager that picks who speaks |
| [CAMEL](https://arxiv.org/abs/2303.17760) (2023) | Two agents role-play a user and an assistant to finish a task | Role prompts ("inception prompting"), and how conversations go wrong (loops, role swapping) |
| [ChatDev](https://arxiv.org/abs/2307.07924) (2023) | A fake software company: CEO, CTO, programmer, tester agents | A fixed pipeline of phases; it has a simple visualizer |
| [MetaGPT](https://arxiv.org/abs/2308.00352) (2023) | Like ChatDev, but agents follow standard procedures and share documents | Structured outputs instead of free chat |
| [Generative Agents](https://arxiv.org/abs/2304.03442) (Stanford, 2023) | 25 agents live in a small virtual town | Memory, reflection, and a **visual** world you can watch |

For each paper, write in `DIARY.md`:

1. How do the agents work together? (pipeline, chat, manager and workers, role-play, …)
2. How does a person **see** what the agents are doing? (text log, visual, nothing)
3. What problems do the authors mention? (loops, hallucination, agents forgetting their role, cost)
4. One sentence: what could my platform show better?

**Done when:** you have notes for all five papers.

---

## Task 2 · Try three existing tools (about 1 hour each)

All three are Python. Make a separate virtual environment so they don't conflict:

```sh
python3 -m venv ~/venvs/week3
source ~/venvs/week3/bin/activate
```

Use your free local model in all three. Ollama has an OpenAI-compatible address: `http://localhost:11434/v1`
(model `qwen3:8b`, any text as the API key).
Install steps change often, so **follow each tool's current quickstart** if a command below fails.

### AutoGen Studio

A no-code web UI for building AutoGen agent teams.

```sh
pip install autogenstudio
autogenstudio ui --port 8081   # then open http://localhost:8081
```

Add a model that points to the Ollama address above, build a two-agent team, and give it a small task.

### CrewAI

A Python library where agents have a *role*, a *goal* and *tasks*.
Follow the quickstart, and set the model to `ollama/qwen3:8b`. Make a two-agent crew (e.g. researcher + writer).
Note: CrewAI has no visual view of its own by default. That is also a finding.

### LangGraph Studio

A visual debugger for agents built with LangGraph: shows the agent as a graph and lets you step through it.
Follow the LangGraph quickstart; `langgraph dev` starts the Studio in your browser.
It may ask for a free LangSmith account.

### What to note for each tool

Copy this into `DIARY.md` for each tool and fill it in. Take **screenshots**: you will use them in the thesis.

```md
### <Tool name>
- Define a team: code / form / drag-and-drop?
- Live view while running: graph / chat log / nothing?
- Inspect one step (exact prompt, tokens, tool calls)?
- Replay a finished run?
- Worked with a local 8B model? Problems?
- Best thing:
- Most missing:
```

If a tool won't run after ~30 minutes, stop. Note *why* it failed (that is a valid finding) and move on.

**Done when:** you have the notes and screenshots for all three.

---

## Task 3 · Build `learning/03-debate.ts` (about 1–2 days)

Your first multi-agent program, still in the terminal.

### The agents

| Agent | System prompt (idea) |
| --- | --- |
| **Pro** | "You argue FOR the topic. Reply to your opponent's last point. Max 80 words." |
| **Con** | "You argue AGAINST the topic. Reply to your opponent's last point. Max 80 words." |
| **Judge** | "You read a debate and pick the winner. Give the winner and 2–3 reasons." |

### The flow

```
topic → Pro → Con → Pro → Con → (rounds) → Judge → verdict
```

### The key idea

An agent is just **a name + a system prompt + what it is allowed to see**. All three use the same `chat()`
from `learning/ollama.ts`. The orchestrator (your loop) decides who speaks next and what they see:

- Pro and Con see the debate so far. Their own past turns are `assistant` messages;
  the opponent's turns are `user` messages.
- The Judge sees the whole debate as one text, with each turn labelled `Pro:` or `Con:`.

### Steps

1. Make a type `Agent = { name: string; systemPrompt: string }` and create the three agents.
2. Keep one shared list of turns: `{ speaker: string; text: string }[]`.
3. Write a function `messagesFor(agent, turns)` that builds that agent's own `Message[]`.
4. Loop for N rounds (start with 2): Pro speaks, then Con. Stream each reply with `onToken`.
5. Send the full debate to the Judge and print the verdict.
6. Print `[event]` lines that name the agents, for example:

```
[event] debate_started  topic="..."
[event] agent_started   agent=Pro round=1
[event] agent_message   from=Pro to=Con  tokens=...  ms=...
[event] agent_started   agent=Judge
[event] debate_finished winner=Con
```

7. Add `"debate": "node learning/03-debate.ts"` to `package.json` and run `npm run debate -- "Remote work is better than office work"`.

### Things to try (note the results in the diary)

- Does an agent forget its side after a few rounds?
- Do the replies get repetitive?
- Does the Judge always pick the last speaker? (Swap who goes first and run again.)
- How many tokens does each round use, and does it grow?

**Why this matters:** in Week 4 this file becomes the orchestrator in `apps/server`, and in Week 5 the
`agent_message` events become moving edges between Pro, Con and Judge nodes in the graph.

**Done when:** `npm run debate` runs to a verdict, and the events name who talks to whom.

---

## Task 4 · Draft the literature review (about 1–2 days)

A first draft of 3–5 pages. Don't polish it yet. Suggested structure:

1. **LLM agents**: what an agent is; tool use; ReAct; workflows vs. agents (Building Effective Agents).
2. **Multi-agent systems**: the five papers, grouped by pattern
   (role-play: CAMEL; pipeline: ChatDev, MetaGPT; group chat: AutoGen; simulation: Generative Agents).
3. **Existing tools**: AutoGen Studio, CrewAI, LangGraph Studio (from your Task 2 notes).
4. **Comparison table** (example below).
5. **The gap**: one paragraph explaining what none of them does well, which is why your platform is needed.

### Comparison table (template)

| | AutoGen Studio | CrewAI | LangGraph Studio | ChatDev | **This platform** |
| --- | --- | --- | --- | --- | --- |
| Define a team | | | | | visual builder |
| Live view of the team | | | | | live graph |
| Inspect one step | | | | | prompt, reply, tokens, time |
| Replay a run | | | | | timeline |
| Free local models | | | | | yes (Ollama) |
| Open source | | | | | yes |

Fill the empty cells from your notes. Be fair: write what they do well too.
Use a reference manager (Zotero is free) to keep the citations from the start.

**Done when:** the draft and the table are complete enough to show your supervisor.

---

## End of week checklist

- [ ] Paper notes in `DIARY.md`
- [ ] Tool notes + screenshots
- [ ] `npm run debate` works
- [ ] Literature review draft + comparison table
- [ ] Tick the tasks in the [roadmap tracker](https://claude.ai/artifact/SNVKp1dvsXVKaEBKAx5k5p)
