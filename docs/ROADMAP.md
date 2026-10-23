# Roadmap

From a first model call to a finished thesis. The plan has two parts:

- **Part A – Prototype** (Oct 12 – Dec 1, weekly): learn the basics and build a working demo for the 40% checkpoint.
- **Part B – Full system and thesis** (Dec – Apr, monthly): finish the platform, evaluate it with users, write the thesis.

The live checklist (tick tasks there) is the [roadmap tracker](https://claude.ai/artifact/SNVKp1dvsXVKaEBKAx5k5p).
The reasoning behind the plan is in the [project proposal](https://claude.ai/code/artifact/8e9e9553-9b57-4c89-8e44-bc70a2c30120).
After every work session, write 3–5 lines in [`DIARY.md`](DIARY.md).

Each week below has a **goal**, the **tasks**, and **done when**: how you know you can move on.

---

## Part A – Prototype

### Week 1 · Oct 12–18 · Talk to a local model

**Goal:** understand what an LLM call is and run one on your own laptop for free.

- [x] Install Ollama and download `qwen3:8b`.
- [x] Run `npm run hello` and try the experiments at the top of `learning/01-hello-llm.ts`
      (change the system prompt, the temperature, the question).
- [x] Read [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) (Anthropic).
      Learn the difference between a *workflow* (fixed steps) and an *agent* (the model decides the steps).
- [x] Understand the basic words: messages, system prompt, tokens, temperature, context window.
- [x] Write the first `DIARY.md` entry.

**Done when:** you can explain what goes into a chat request and what comes back.

### Week 2 · Oct 19–25 · An agent that uses tools

**Goal:** turn one LLM call into an *agent*: a loop where the model can call your functions.

- [x] Read the [ReAct paper](https://arxiv.org/abs/2210.03629): abstract, figures, examples.
      ReAct = the model alternates *reasoning* and *acting* (calling tools).
- [x] Run `npm run agent` and explain every line of the loop in `learning/02-agent-with-tools.ts`.
- [x] Add a tool yourself: `save_note` (writes to `notes.md`).
- [x] Stream the answer word by word (`stream: true` in `learning/ollama.ts`).

**Done when:** the agent can use several tools in a row, and you see its answer appear live.

### Week 3 · Oct 26 – Nov 1 · Many agents, and what exists already

**Goal:** go from one agent to a team, and learn what other people have built.
Detailed plan: [`docs/week-3.md`](week-3.md).

- [x] Skim five papers: [AutoGen](https://arxiv.org/abs/2308.08155), [CAMEL](https://arxiv.org/abs/2303.17760),
      [ChatDev](https://arxiv.org/abs/2307.07924), [MetaGPT](https://arxiv.org/abs/2308.00352),
      [Generative Agents](https://arxiv.org/abs/2304.03442).
- [x] Try AutoGen Studio, CrewAI and LangGraph Studio (about an hour each). Note what they show and what they miss.
- [x] Build `learning/03-debate.ts`: Pro, Con and Judge agents debating in the terminal.
- [x] Draft the literature review and its comparison table.

**Done when:** the debate runs end to end, and you can say in one paragraph what existing tools are missing.

### Week 4 · Nov 2–8 · Server and live events

**Goal:** move the agents from a terminal script into a server that sends events to a browser.
Detailed plan: [`docs/week-4.md`](week-4.md).

- [x] Learn Express basics: routes, JSON bodies, static middleware.
- [x] Learn WebSockets with the `ws` library (the server can push messages to the browser at any time).
- [x] In `apps/server`, turn the debate into an **orchestrator**: code that runs the agents and emits
      typed events (`agent_started`, `llm_token`, `tool_called`, `agent_message`, …) defined in `packages/shared`.
- [x] Stream those events to a simple HTML test page and print them there.

**Done when:** you start a debate from the browser and see the events arrive live.

### Week 5 · Nov 9–15 · The live graph

**Goal:** the core idea of the thesis: watch the agents as a graph.
Detailed plan: [`docs/week-5.md`](week-5.md).

- [x] Create `apps/web` with Vite (React + TypeScript).
- [x] Do the [React Flow tutorial](https://reactflow.dev/learn).
- [x] Draw agents as nodes; highlight the agent that is working right now.
- [x] Animate an edge when one agent sends a message to another.
- [x] Add a message log panel next to the graph (the "text view" you will compare against in the study).

**Done when:** a debate plays out live as a graph in the browser.

### Week 6 · Nov 16–22 · Storage and writing

**Goal:** make runs permanent, and start the thesis chapters.
Detailed plan: [`docs/week-6.md`](week-6.md).

- [x] SQLite + Drizzle: save every run and all its events (this makes replay possible later).
- [x] A form to create an agent: name, role, instructions (system prompt), model.
- [x] Write the **Requirements** chapter (what the platform must do, and for whom).
- [x] Write the **Architecture** chapter (server, orchestrator, events, web client; with a diagram).

**Done when:** a run is still there after restarting the server, and both chapters have a full draft.

### Week 7 · Nov 23 – Dec 1 · 40% checkpoint (deadline)

**Goal:** submit a working demo and report.
Detailed plan: [`docs/week-7.md`](week-7.md).

- [ ] Fix the roughest edges of the demo.
- [ ] Record a 3-minute demo video and take screenshots.
- [ ] Finish the checkpoint report (proposal + literature review + requirements + architecture + progress).
- [ ] **Submit by December 1.**

**Done when:** submitted.

---

## Part B – Full system and thesis

### December · Team builder and interaction patterns

**Goal:** users build their own teams, and the platform supports several ways for agents to work together.
Detailed plan: [`docs/december.md`](december.md).

- [ ] Drag-and-drop team builder in React Flow.
- [ ] **Sequential pipeline:** A → B → C, each gets the previous output.
- [ ] **Manager and workers:** one agent splits the task and hands parts to others.
- [ ] **Group discussion:** agents take turns in a shared conversation (the debate, generalised).

### January · Inspect and replay

**Goal:** understand what happened in a run, step by step.
Detailed plan: [`docs/january.md`](january.md).

- [ ] Step inspector: click a step to see its exact prompt, reply, tool calls, tokens and time.
- [ ] Run history list.
- [ ] Replay timeline: scrub back and forth through a finished run.
- [ ] Tokens and time per agent (simple charts).

### February · Stretch feature and study prep

**Goal:** one extra feature, an easy setup, and everything ready for the user study.
Detailed plan: [`docs/february.md`](february.md).

- [ ] One stretch feature: pause a run and edit a message, **or** compare two runs side by side.
- [ ] Templates: "Debate" and "Research and Report".
- [ ] Docker Compose: the whole demo starts with one command.
- [ ] Prepare study runs with planted problems (e.g. an agent that loops or ignores its role).
- [ ] Ask your university whether the user study needs ethics approval. **Ask early.** (Moved to the first week of December, see `december.md` Task 6.)

### March · Evaluation

**Goal:** show with data that the graph view helps.
Detailed plan: [`docs/march.md`](march.md).

- [ ] Recruit 8–12 participants.
- [ ] Run the study: participants find the planted problems with the graph view and with a plain text log,
      then fill in the SUS (System Usability Scale) questionnaire.
- [ ] Measure technical metrics: event delay, run time, tokens.
- [ ] Analyse and chart the results.

### April · Thesis and presentation (deadline)

Detailed plan: [`docs/april.md`](april.md).

- [ ] Write the **Implementation** chapter.
- [ ] Write the **Evaluation** chapter.
- [ ] Write the **Introduction** and **Conclusion** directions.
- [ ] Prepare the presentation and a live demo (with a recorded backup).
- [ ] **Final submission.**
