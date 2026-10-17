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

Summary and detailed comparative analysis completed in [`comparison_papers.md`](comparison_papers.md) and [`DIARY.md`](DIARY.md).

---

## Task 2 · Try three existing tools (about 1 hour each)

All three tested locally with Ollama + `qwen3:8b`. Full notes recorded in [`DIARY.md`](DIARY.md).

### AutoGen Studio
- **Setup & Interface:** Web UI (`autogenstudio ui --port 8081`). Define agents and teams through forms or JSON.
- **Live View:** Flat chat log + optional message-flow graph (appends a new node for every message exchanged, creating cluttered graphs).
- **Inspection & Replay:** Shows message text and token counts; no exact underlying prompt, no per-step execution timing. Graph nodes are not interactive. No step-by-step playback after completion.
- **Local 8B Model:** Works over Ollama's OpenAI-compatible endpoint, but runs sluggishly; ignores `/no_think` formatting.
- **Key Takeaways:** Good no-code entry point, but lacks step-level execution diagnostics and structured conversation replay.

### CrewAI
- **Setup & Interface:** Python code (`~/venvs/crewai`). Agents configured by Role, Goal, and Backstory; tasks tied to expected outputs.
- **Live View & Execution:** Terminal logs with colored text boxes. Sequential mode (`learning/crewai/crew.py`) completed fast (46s, 2,372 tokens). Hierarchical mode (`Process.hierarchical`) introduced an autonomous Crew Manager that failed silently: delegated task 1, wrote task 2 itself while bypassing the Writer agent, hallucinated non-existent facts, and consumed ~5× the tokens (12,750 tokens / 12 calls) while declaring "Task Completed".
- **Inspection & Tracing:** Terminal hides exact prompts. Tracing requires uploading full prompt traces to cloud-hosted `app.crewai.com`.
- **Key Takeaways:** Clear role abstractions, but complete absence of local visual interaction. Unreliable autonomous delegation is invisible without external cloud tracing.

### LangGraph Studio
- **Setup & Interface:** Python workflow (`~/venvs/langgraph`), visualized via local LangGraph dev server connected to LangSmith UI.
- **Live View & Replay:** Excellent live node highlighting and word-by-word streaming. Supports interactive "Time Travel" (editing state attributes like `facts` and forking the workflow).
- **Local 8B Model:** Fast (~20s) with `ChatOllama(reasoning=False)`.
- **Key Takeaways:** Graph diagrams depict *code control flow* (functions and state transitions) rather than *social agent communication* (who said what to whom). Requires cloud account integration (LangSmith); purely code-first.

---

## Task 3 · Build `learning/03-debate.ts` (about 1–2 days)

First local multi-agent prototype implemented in [`learning/03-debate.ts`](../learning/03-debate.ts).

### Architecture & Agent Structure
- **Pro:** Argues in favor of the proposition (`FOR`).
- **Con:** Argues against the proposition (`AGAINST`).
- **Judge:** Observes the full debate transcript and delivers an evaluated verdict with 2–3 explicit justifications.
- **State & Perspective:** Pure Node.js orchestrator managing a shared `turns: Turn[]` list. Each agent's context is synthesized dynamically by `messagesFor(agent, turns, topic)`, projecting previous turns into native `assistant` (self) and `user` (opponent) messages.

### Experimental Findings
1. **Token Dynamics:** Input prompt tokens grow linearly per round (~50 → 115 → 170 → 230 tokens) as the conversation context accumulates, while output tokens remain steady (~50–65 tokens) respecting the 80-word prompt cap.
2. **Prefix Mirroring:** In multi-turn context, the model mirrors conversation formatting (e.g., prefixing `Pro:` onto its own output), resolved by regex normalization and prompt constraints.
3. **Role Flipping on Ambiguous Prompts:** When given controversial/absolute topics (e.g., `"people must marry"`), an 8B model's alignment bias can override weak system prompts in Round 1, arguing against the topic unless explicitly instructed to defend the proposition within a formal debate simulation.
4. **Judge Evaluation:** The Judge agent reliably identifies inconsistencies and delivers structured justifications based on argumentation strength and logical coherence.

---

## Task 4 · Literature Review Draft

### 1. LLM Agents: Foundations and Tool Use

An **LLM agent** extends a passive autoregressive language model into an autonomous entity capable of perceiving its environment, reasoning over objectives, and taking actions through external tools. Unlike standard chatbots that operate as single-turn text generators, an agent operates within an execution loop:

$$\text{Observation} \longrightarrow \text{Reasoning (Thought)} \longrightarrow \text{Action (Tool Call)} \longrightarrow \text{Environment Feedback}$$

The foundational paradigm formalizing this cycle is **ReAct** (Yao et al., 2022). ReAct integrates *reasoning traces* and *task-specific actions* in an interleaved manner. Reasoning allows the model to track progress, handle exceptions, and adjust plans, while external actions (e.g., querying search engines, executing Python code, calling calculators) ground the model in real-world facts and overcome core LLM limitations such as arithmetic errors and stale knowledge.

In *Building Effective Agents* (Anthropic, 2024), agentic systems are classified along a spectrum of autonomy:
- **Workflows:** Systems where LLMs and tools are orchestrated through predefined, hardcoded code paths and state machines (e.g., prompt chaining, routing, parallel voting, orchestrator-workers). Workflows offer high predictability, lower latency, and consistent quality.
- **Autonomous Agents:** Systems where the LLM dynamically dictates its own execution path, choosing which tools to invoke and when to terminate. While flexible, autonomous agents introduce non-determinism, compounding errors, and infinite loops when small or unaligned models fail to converge.

### 2. Multi-Agent Systems: Architectural Patterns

When tasks grow in complexity, a single agent's context window quickly overflows with verbose tool outputs and reasoning traces. Multi-agent systems decompose problems across specialized agents, leveraging four primary architectural patterns:

#### A. Role-Playing and Dyadic Collaboration: CAMEL
**CAMEL** (Li et al., 2023) pioneered *inception prompting* to enable autonomous cooperation between two communicative agents: an AI User and an AI Assistant. A third agent ("Task Specifier") generates concrete sub-tasks from an initial prompt. The agents alternate in a strict Instruction-Solution loop:
- **Strengths:** Eliminates human intervention during task execution; generates extensive synthetic conversational datasets.
- **Failure Modes:** Exposed critical failure modes in LLM interactions: *role flipping* (agents swapping identities or taking the opposing stance), *instruction looping* (endlessly repeating identical suggestions), and *flake replies* (conversational pleasantries without substance).
- **Context Cost:** Costs grow quadratically $\mathcal{O}(N^2)$ as message history expands, necessitating hard round caps.

#### B. Software Engineering Pipelines: ChatDev and MetaGPT
Both frameworks simulate real-world software development teams, but approach inter-agent communication from opposing philosophies:
- **ChatDev** (Qian et al., 2023) organizes agents (CEO, CTO, Programmer, Reviewer, Tester) into a sequential waterfall pipeline decomposed into phases (Designing, Coding, Testing, Documenting). Within each phase, two agents engage in multi-turn chat. ChatDev introduces *communicative dehallucination*, where the developer agent asks clarifying questions before writing code, and passes only finalized code artifacts across phases to keep context windows compact.
- **MetaGPT** (Hong et al., 2023) argues that unconstrained natural language chat acts like a "game of telephone," degrading information quality. Instead, MetaGPT encodes **Standard Operating Procedures (SOPs)** into agents, requiring them to produce structured engineering artifacts (Product Requirement Documents, System Architecture diagrams, Data API specifications, Task Lists). Communication is mediated through a global **publish-subscribe message pool**, preventing message overload and achieving higher benchmark reliability (85.9% on HumanEval).

#### C. Dynamic Group Chat and Conversable Agents: AutoGen
**AutoGen** (Wu et al., 2023) provides a generalized multi-agent programming framework built around *Conversable Agents*. Agents can be powered by LLMs, human operators, or code execution environments. AutoGen supports flexible topologies, notably **Group Chat**, where a centralized `GroupChatManager` dynamically selects which agent speaks next based on current conversation context. While expressive, AutoGen leaves orchestration policies and termination conditions entirely to the developer, leading to unpredictable routing when running smaller open-source models.

#### D. Social Simulation and Cognitive Architectures: Generative Agents
**Generative Agents** (Park et al., 2023) models 25 autonomous agents inhabiting a virtual sandbox town ("Smallville"). Rather than focusing on task completion, it introduces a comprehensive cognitive architecture:
1. **Memory Stream:** A comprehensive log of an agent's past experiences, retrieved dynamically using a weighted scoring function combining *Recency*, *Importance*, and *Relevance*.
2. **Reflection Trees:** Higher-level abstract thoughts synthesized periodically from raw memories to guide long-term behavior.
3. **Recursive Planning:** Hierarchical decomposition of daily agendas into hourly actions, dynamically revised upon perceiving environmental changes or conversations.

### 3. Existing Developer Tools and Empirical Limitations

To evaluate current tooling, three major frameworks were tested locally using Ollama (`qwen3:8b`):

1. **AutoGen Studio:** Offers a straightforward no-code GUI for constructing agents and groups. However, its visual representation relies on a static message-flow graph where every message spawns a new node, producing visual clutter rather than illuminating agent topology. Furthermore, it lacks step-by-step playback, execution timing benchmarks, and detailed prompt inspectability.
2. **CrewAI:** Simple high-level abstractions (`Agent`, `Task`, `Crew`). However, terminal logs conceal underlying prompt construction. In testing, hierarchical orchestration failed catastrophically with local 8B models: the manager agent swallowed subtask outputs, hallucinated answers, and consumed $5\times$ more tokens without notifying the user. Tracing is offloaded to a proprietary cloud web service (`app.crewai.com`), providing no local, offline visual interface.
3. **LangGraph Studio:** Best-in-class workflow inspection, providing live node execution states and state modification ("Time Travel"). However, LangGraph models *computation graphs* (functions, state reducers, and conditional branches) rather than *agent communication* (who communicated what message to whom). Additionally, the studio interface depends on cloud authentication through LangSmith.

### 4. Framework Comparison Table

| Feature / Dimension | AutoGen Studio | CrewAI | LangGraph Studio | **Proposed Platform** |
| :--- | :--- | :--- | :--- | :--- |
| **Team Definition** | Form / JSON UI | Python code | Python code | **Visual Drag-and-Drop + No-Code UI** |
| **Live Execution View** | Cluttered message graph | Colored text logs | Node highlight (code graph) | **Live interactive agent graph + animated edges** |
| **Interaction Focus** | Message flow | Task execution | Function execution & state | **Social agent dialogue ("Who talks to whom")** |
| **Step-Level Inspector** | Text & tokens only | Cloud trace only (app.crewai.com) | State diff only (prompts in cloud) | **Local: exact prompt, response, tokens, timing & tools** |
| **Run Replay** | Static post-run log | None (terminal scrolls) | State fork / re-run | **Step-by-step timeline scrubber from event log** |
| **Supported Topologies** | Group chat, 1-on-1 | Sequential, Hierarchical | Directed StateGraph | **Sequential, Manager-Worker, Group Discussion** |
| **Local Model Support** | Yes (via OpenAI URL) | Yes (Ollama) | Yes (Ollama) | **Native Ollama integration (Zero cost, offline)** |
| **Open Source & Local** | Yes | Framework open / Tracing closed | Framework open / Studio hosted | **100% Local (Fastify + SQLite + React Flow)** |

### 5. The Research Gap

Current multi-agent tools bifurcate into two extremes: developer-oriented Python code frameworks (LangGraph, CrewAI) that conceal interaction dynamics behind dense terminal logs or closed cloud dashboards, and domain-specific rigid pipelines (MetaGPT) that cannot be reconfigured for general interaction patterns. Crucially, **none of the existing platforms provide an accessible, local-first web environment that renders live, message-level agent interactions as an intuitive graph while allowing complete, deterministic post-run replay.**

When multi-agent systems fail—such as when agents fall into infinite conversational loops, suffer role-reversal hallucinations (as observed in CAMEL), or execute erroneous delegation cycles (as observed in CrewAI)—debugging with raw text streams is cognitively overwhelming. There is a distinct need for an orchestration platform built on a unified **event-sourced architecture**, where every system occurrence is recorded as an immutable, typed event. By decoupling agent orchestration from presentation, such a platform enables real-time visual comprehension, detailed per-step telemetry (prompts, tool calls, token usage, execution latency), and non-destructive historical replay, enabling students, researchers, and developers to analyze and debug collaborative intelligence efficiently without relying on commercial cloud APIs.

---

## End of week checklist

- [x] Paper notes in `DIARY.md`
- [x] Tool notes + screenshots
- [x] `npm run debate` works
- [x] Literature review draft + comparison table
- [x] Tick the tasks in the [roadmap tracker](https://claude.ai/artifact/SNVKp1dvsXVKaEBKAx5k5p)
