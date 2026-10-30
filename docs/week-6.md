# Week 6 · Complete 6-Week Deep Dive, System Analysis & Storage/Writing Milestone

> **Purpose of this document:** This guide provides a comprehensive, textbook-level explanation of **everything built across Weeks 1–6** of the *Multi-Agent Orchestration and Visualization Platform* thesis project—from the raw HTTP bytes sent to a local LLM in Week 1 to the full-stack event-sourced React Flow + Express + WebSocket + SQLite platform completed in Week 6.

---

## 1. The Big Picture: What Problem Are We Solving and Why?

### 1.1 The Core Problem
When multiple LLM agents collaborate (debating, researching, writing, or delegating work), their behavior is traditionally hidden inside scrolling terminal logs or proprietary cloud traces. When a multi-agent run fails, a student or developer struggles to answer basic questions:
- **Who is talking to whom right now?**
- **Which agent caused the error or flipped its role?**
- **Did a manager agent actually delegate the task, or did it hallucinate the answer itself?**
- **How many tokens and milliseconds did each turn cost?**

### 1.2 The Thesis Research Question
> *"Does an interactive graph visualization help users understand and debug multi-agent LLM systems faster and more accurately than text logs?"*

### 1.3 The Three Golden Architectural Pillars Built in Weeks 1–6
Everything in this repository is built around three unifying engineering principles:
1. **Everything is an Event (`AgentEvent`):** Every action in the system (`run_started`, `agent_started`, `llm_token`, `llm_response`, `message_sent`, `agent_finished`, `run_finished`) is an immutable, strictly typed TypeScript object defined once in `packages/shared/src/events.ts`.
2. **Inversion of Control (`emit` callback):** The multi-agent orchestrator (`runDebate`) has **zero knowledge** of WebSockets, databases, or React. It simply calls `emit(event)`. Because of this, we streamed events to a browser in Week 4 and saved them to SQLite in Week 6 without changing the orchestrator's core logic.
3. **Pure Event Sourcing Reducer (`applyEvent`):** The React frontend never mutates state piecemeal from random callbacks. Instead, the entire UI state (`RunState`) is computed deterministically via:
   $$\text{State} = \text{events.reduce}(\text{applyEvent}, \text{initialState})$$
   This single decision made **historical run replay in Week 6 require zero new visualization code**—feeding saved events from SQLite into `loadEvents(pastEvents)` reconstructs the exact graph and message log automatically.

---

## 2. Chronological Deep Dive: Weeks 1 to 6

---

### Week 1 · Talking to a Local Model Over the Wire (`learning/ollama.ts`, `learning/01-hello-llm.ts`)

#### What Was Built
Instead of using a heavy black-box SDK, you wrote a custom, zero-dependency HTTP streaming client for Ollama (`learning/ollama.ts`, 100 lines) and a first test script (`learning/01-hello-llm.ts`).

#### Deep Technical Mechanics
1. **Statelessness of LLMs:** An LLM has **no memory** between calls. In `01-hello-llm.ts`, "memory" is created by sending the entire `Message[]` array (`system` $\rightarrow$ `user` $\rightarrow$ `assistant` $\rightarrow$ `user`) on every request to `POST http://localhost:11434/api/chat`.
2. **NDJSON Streaming & TCP Chunk Buffering (`learning/ollama.ts` lines 61–84):**
   - When `stream: true` is passed to Ollama, it responds with **Newline-Delimited JSON (NDJSON)**—each line is a separate JSON object (`StreamChunk`) containing a few characters (`message.content`) and `done: boolean`.
   - **Why `buffer` is critical:** Network packets (`for await (const bytes of response.body)`) can split a JSON line right down the middle! Your code decodes raw bytes with `TextDecoder`, splits on `\n`, pops the last potentially incomplete line back into `buffer`, and parses every complete line with `JSON.parse(line)`.
   - On each piece of text, it invokes `onToken?.(piece)` immediately—this is the exact callback that powers live word-by-word streaming in the terminal (Week 2–3) and live speech bubbles inside React Flow nodes (Week 5–6).
   - When the final chunk (`chunk.done === true`) arrives, Ollama attaches telemetry in nanoseconds (`total_duration`) and token counts (`prompt_eval_count`, `eval_count`), which your code converts to milliseconds (`Math.round(total_duration / 1e6)`).
3. **`think: false`:** Qwen 3 (`qwen3:8b`) is a hybrid reasoning model that by default generates long `<think>...</think>` chains before answering. Setting `think: false` disables hidden reasoning tokens so responses stream immediately and rapidly on a laptop.

---

### Week 2 · Turning an LLM into an Autonomous Agent (`learning/02-agent-with-tools.ts`)

#### What Was Built
A complete **ReAct (Reason + Act)** agent loop in `learning/02-agent-with-tools.ts` equipped with four deterministic tools:
- `calculate` (`add`, `subtract`, `multiply`, `divide`)
- `get_current_date` (returns `YYYY-MM-DD`)
- `days_between` (computes exact days between two `YYYY-MM-DD` dates)
- `save_note` (appends timestamped notes to `../learning/notes.md` via `node:fs`)

#### Deep Technical Mechanics
1. **How Tool Calling Works:**
   - An LLM cannot execute code or check the system clock itself. Instead, you pass a `ToolDefinition[]` JSON Schema array in the `/api/chat` request body describing each function's name, purpose, and parameters.
   - Instead of replying with text, the model replies with `message.tool_calls` (e.g., `get_current_date({})`).
   - Your `for (let step = 1; step <= MAX_STEPS; step++)` loop intercepts `message.tool_calls`, executes the real TypeScript function `runTool(name, args)`, and appends a `{ role: "tool", content: output, tool_name: name }` message back into `messages[]`.
   - The loop then calls `chat(messages, tools)` again so the model can read the tool's output and either call another tool (e.g., `days_between`, then `calculate`) or produce its final natural-language answer.
2. **First Empirical Bug & Thesis Lesson (Empty Reply & Missing Tools):**
   - **What broke:** When asked *"How many days until December 1, 2026?"* without a `days_between` tool, the 8B model sometimes failed silently and returned an empty string `""`.
   - **How you fixed it:** Added the `days_between` tool AND added a guard (lines 142–146): if `!message.tool_calls?.length && !message.content.trim()`, emit `[event] empty_reply`, push `"Please give your final answer now."`, and `continue` the loop.
   - **Thesis takeaway:** Small local 8B models require explicit, well-scoped tools and defensive loop guards, and the visualization platform must surface empty/failed steps rather than hiding them.

---

### Week 3 · Multi-Agent Systems, Literature Review, Tool Benchmarks & Terminal Debate

#### 1. Literature Review (`docs/comparison_papers.md` & `docs/week-3.md`)
You analyzed and compared five foundational 2023 multi-agent papers across communication structure, topology, memory, and failure modes:
- **CAMEL (Li et al., 2023):** Role-playing User + Assistant via *inception prompting*. Documented key failure modes: **role flipping**, **instruction looping**, and **flake replies**, plus $\mathcal{O}(N^2)$ context growth.
- **ChatDev (Qian et al., 2023):** Waterfall software company pipeline (CEO, CTO, Programmer, Tester) using dyadic chats and *communicative dehallucination*.
- **MetaGPT (Hong et al., 2023):** Replaces unstructured chat ("game of telephone") with **Standard Operating Procedures (SOPs)**, structured documents (PRDs, API specs), and a publish-subscribe message pool.
- **AutoGen (Wu et al., 2023):** Conversable agents supporting flexible topologies and dynamic `GroupChatManager` speaker selection.
- **Generative Agents (Park et al., 2023):** 25 agents in "Smallville" with a cognitive architecture combining a **Memory Stream** (recency, importance, relevance), **Reflection Trees**, and **Recursive Planning**.

#### 2. Hands-On Empirical Testing of Existing Tools with `qwen3:8b` (`docs/DIARY.md`)
You tested all three leading industry tools locally on your machine with `qwen3:8b` to prove the research gap empirically:
- **AutoGen Studio:** Has a no-code UI, but its "graph" spawns a new box for every single message (cluttered message tree, not an agent interaction topology). Nodes aren't clickable, prompts and timings are hidden, `/no_think` was ignored, and tool configuration required raw JSON (`function_calling: true`) while the UI falsely displayed `"0 Tools"`.
- **CrewAI (`learning/crewai/crew.py`):** Python-only. Sequential mode worked fast (46 s, 4 calls, 2,372 tokens). **Critical finding in `Process.hierarchical`:** CrewAI inserts a hidden "Crew Manager" agent. On the topic `"colombia"`, the Manager delegated Task 1 to the Researcher, threw away the Researcher's facts, **skipped the Writer agent entirely** on Task 2, wrote the paragraph itself with hallucinated facts (Ecuador, bananas, oil), used **5× more tokens** (12,750 tokens, 12 calls), and printed `"Task Completed"` at the end! On a second run, it didn't delegate either task. Without cloud tracing (`app.crewai.com`), this silent failure is completely invisible.
- **LangGraph Studio (`learning/langgraph/agent.py`):** Best debugger (live node highlight, state inspection, time-travel state forking—tested by injecting a fake `"purple dragon called Pedro"` fact and re-running only the Writer). However, it draws **code control flow** (Python functions and state reducers), not **social agent dialogue** (who said what to whom), requires Python code, and requires a cloud LangSmith account.

#### 3. Building the 3-Agent Terminal Debate (`learning/03-debate.ts`)
You built a 3-agent orchestrator (`Pro`, `Con`, `Judge`) in TypeScript:
- **Perspective Shifting (`messagesFor`, lines 39–58):** How do you make two agents debate using a standard chat API that only understands `system`, `user`, and `assistant`?
  - When building the prompt for `Pro`, all of `Pro`'s own past turns are mapped to `{ role: "assistant", content: turn.text }`, while all of `Con`'s turns are mapped to `{ role: "user", content: "Con: " + turn.text }`.
  - When `Con` speaks, the perspective flips: `Con` sees its own past turns as `assistant` and `Pro`'s turns as `user`!
  - Finally, `Judge` receives the entire concatenated `transcript` in a single `user` message and outputs the verdict and reasons.
- **Two Real Bugs Discovered & Fixed in `03-debate.ts`:**
  1. **Prefix Echoing (`"Pro: Pro: ..."`):** Because opponent turns were formatted as `"Con: ..."`, the 8B model imitated the prefix and started its own reply with `"Pro: ..."`. Fixed by adding `"Do not start your reply with 'Pro:'."` to the system prompt and stripping `.replace(/^Pro:\s*/i, "")`.
  2. **CAMEL Role Flipping in Round 1:** On the controversial topic `"people must marry"`, `Pro` argued *against* marriage in Round 1! Why? Because on Turn 1 there was no opponent turn yet, and the prompt said *"Reply to your opponent's last point"*—so the 8B model treated the topic itself as the opponent's claim and followed its safety/alignment bias toward personal freedom. Fixed by explicitly injecting the stance (`arguing strictly FOR (in favor of) this topic, even as a role-play exercise`) into both the system prompt and initial user message.

---

### Week 4 · Server, Shared Event Contract, Decoupled Orchestrator & WebSockets

#### What Was Built
1. **Shared Workspace Package (`packages/shared/src/events.ts`):**
   - Created an npm workspace monorepo (`packages/*`, `apps/*`) so backend and frontend share one source of truth: `@agent-platform/shared`.
   - Defined `BaseEvent` (`id`, `runId`, `timestamp`) and the discriminated union `AgentEvent` with 9 event types:
     - `run_started`, `agent_started`, `llm_token`, `llm_response`, `message_sent`, `tool_called`, `tool_result`, `agent_finished`, `run_finished`.
2. **Type-Safe Event Factory (`apps/server/src/events.ts`):**
   - Wrote `DistributiveOmit<T, K>` and `makeEvent(runId, event)` so the server automatically attaches `id: crypto.randomUUID()`, `runId`, and `timestamp: Date.now()` without flattening TypeScript's discriminated union.
3. **Decoupled Debate Orchestrator (`apps/server/src/orchestrator/debate.ts`):**
   - Refactored `03-debate.ts` into `runDebate(runId, topic, emit, customAgents)` wrapped in a `try / catch` block.
   - If Ollama crashes or stops mid-run, the `catch` block immediately emits `{ type: "run_finished", status: "failed" }`—directly solving CrewAI's silent failure problem.
4. **Express + WebSocket Server (`apps/server/src/index.ts`):**
   - Attached `WebSocketServer` (`ws`) to the Node HTTP server on path `/ws`.
   - When a client sends `{ type: "start_run", topic }`, the server generates a `runId` and streams every emitted `AgentEvent` over the socket in real time.

#### Experimental Measurements & Bugs Fixed in Week 4
- **Bug (`app.listen` vs `server.listen`):** Calling `app.listen(3000)` created a separate HTTP server that ignored the `WebSocketServer` attached to `const server = createServer(app)`. Fixed by calling `server.listen(3000)`.
- **Bug (TypeScript union flattening):** Standard `Omit<AgentEvent, "id">` strips variant-specific properties (`agentId`, `text`, etc.) in TypeScript. Fixed with distributive conditional type `T extends unknown ? Omit<T, K> : never`.
- **Measured WebSocket Latency:** `Date.now() - event.timestamp` in the browser averaged **1–4 ms** (well below the 200 ms NFR1 target).
- **Multi-Tab Isolation:** Opening two browser tabs and running two debates simultaneously did not mix events because each WebSocket connection has its own isolated closure `(event) => socket.send(...)`.

---

### Week 5 · The Live Interactive Graph and Synchronized Message Log (`apps/web`)

#### What Was Built
1. **Pure Event Reducer (`apps/web/src/runState.ts`):**
   - Defined `RunState` containing `status`, `agents` (`Record<string, AgentState>`), `messages` (`MessageItem[]`), and `activeEdge` (`{ from, to } | null`).
   - Implemented `applyEvent(state: RunState, event: AgentEvent): RunState` as a 100% pure, immutable reducer function:
     - `run_started` $\rightarrow$ initializes `pro`, `con`, `judge` as `idle`, sets run status to `running`.
     - `agent_started` $\rightarrow$ sets that agent to `thinking`, clears its `liveText`.
     - `llm_token` $\rightarrow$ appends `event.text` to that agent's `liveText`.
     - `llm_response` $\rightarrow$ adds `outputTokens` to the agent's cumulative `tokens` and stores `lastResponse: { tokens, durationMs }`.
     - `message_sent` $\rightarrow$ pushes a new `MessageItem` (attaching `tokens` and `durationMs` from `fromAgent.lastResponse`) and sets `activeEdge`.
     - `agent_finished` $\rightarrow$ sets that agent to `done`.
     - `run_finished` $\rightarrow$ sets overall run status; if `failed`, any agent still `thinking` transitions to `error` (red node!).
2. **Custom React Flow Node (`apps/web/src/components/AgentNode.tsx`):**
   - Renders each agent with dynamic status colors and badges:
     - `idle` (slate grey `#475569`)
     - `thinking` (glowing cyan `#38bdf8` with box-shadow aura)
     - `done` (emerald green `#22c55e`)
     - `error` (crimson red `#ef4444`)
   - Shows cumulative token count and a live monospace speech bubble displaying the last 100 characters of `liveText` as tokens stream in.
3. **Aggregated & Animated Directed Edges (`apps/web/src/App.tsx` lines 173–235):**
   - Instead of drawing a new edge for every message (which would create spaghetti after 3 rounds), `computedEdges` groups messages by directed pair (`pro->con`, `con->pro`, `judge->pro`, `judge->con`) and labels each edge with its message count (`3 msgs`).
   - When `judge` sends a verdict to `"all"`, it fans out into two visual edges: `judge->pro` and `judge->con`.
   - A `1500ms` timer (`animatingEdge`) keeps the active edge pulsing in glowing cyan (`#38bdf8`, `strokeWidth: 3`, `animated: true`) so fast turns are clearly visible to the human eye.
4. **Synchronized Message Log (`apps/web/src/components/MessageLog.tsx`):**
   - Side-by-side chronological feed showing `[FROM] → [TO]`, token count, duration in seconds (`3.8 s`), and full message text.
   - **Bidirectional coupling:** Hovering or clicking a message in `MessageLog` highlights and animates the corresponding edge in React Flow; clicking an edge in React Flow selects and highlights the most recent message on that edge in `MessageLog`.

#### Critical Bug Fixed in Week 5
- **The Vanishing Pro Node on Round 3:**
  - *What happened:* Originally, creating a brand-new `nodes` array on every token without React Flow's `useNodesState` / `onNodesChange` caused React Flow to lose its internal DOM dimension measurements (`measured.width` / `measured.height`). When Round 3 started and `liveText` was reset to `""`, the node shrank and React Flow's viewport culling hid the Pro node completely! Furthermore, handles without explicit IDs confused edge routing.
  - *How you fixed it:* Switched to `useNodesState(initialNodes)` and updated only `node.data` inside `useEffect`, preserving React Flow's internal layout measurements; added explicit handle IDs (`top`, `bottom`, `left`, `right`) with directional routing (`pro` $\leftrightarrow$ `con` horizontally via `left`/`right`, `judge` vertically via `top`/`bottom`); and gave the speech bubble a fixed `minHeight: "42px"` with a `"Thinking…"` placeholder.

---

### Week 6 · Persistent Storage (SQLite + Drizzle), Instant Replay, Custom Agents & Thesis Chapters

#### What Was Built
1. **SQLite + Drizzle ORM Database Layer (`apps/server/src/db/`):**
   - Configured `better-sqlite3` and `drizzle-orm` writing to a single zero-config local file (`apps/server/data.db`).
   - Defined three relational tables in `apps/server/src/db/schema.ts`:
     - `agents`: `id` (PK), `name`, `role` (system prompt), `model` (e.g., `"qwen3:8b"`), `createdAt`.
     - `runs`: `id` (PK), `task` (debate topic), `status` (`running | completed | failed | stopped`), `startedAt`, `finishedAt`.
     - `events`: `id` (PK), `runId` (FK $\rightarrow$ `runs.id`), `seq` (strictly increasing integer `1, 2, 3...`), `type`, `payload` (full JSON-serialized `AgentEvent`), `timestamp`.
2. **Real-Time Run & Event Persistence (`apps/server/src/index.ts` lines 137–175):**
   - When `"start_run"` arrives over WebSocket:
     1. Looks up any custom agents (`proId`, `conId`, `judgeId`) from the `agents` table.
     2. Inserts a new row in `runs` with `status: "running"`.
     3. Initializes `let seq = 1` and passes an `emit` callback to `runDebate` that **synchronously inserts every emitted event (including `llm_token`) into the `events` table** before broadcasting it over the WebSocket.
     4. Updates `runs.status` to `"completed"` (or `"failed"` in `catch`) with `finishedAt: Date.now()`.
3. **Orphaned Run Recovery on Server Boot (`apps/server/src/index.ts` lines 25–28):**
   - If the server is killed mid-debate, that run would otherwise remain `"running"` in SQLite forever. On startup, the server executes:
     ```ts
     db.update(runs).set({ status: "stopped", finishedAt: Date.now() }).where(eq(runs.status, "running")).run();
     ```
4. **REST API Endpoints (`apps/server/src/index.ts` lines 40–113):**
   - `GET /runs`: Lists all runs ordered by `startedAt DESC`.
   - `GET /runs/:id/events`: Selects all events for `:id` ordered by `seq ASC` and parses `e.payload` back into `AgentEvent[]`.
   - `GET /agents`, `POST /agents`, `PUT /agents/:id`, `DELETE /agents/:id`: Full CRUD for custom agents.
   - `GET /models`: Queries Ollama's local `http://localhost:11434/api/tags` endpoint to dynamically list all installed local models (with fallback to `["qwen3:8b"]`).
5. **Historical Run Replay UI (`apps/web/src/components/PastRuns.tsx`):**
   - Bottom panel listing all saved runs from SQLite with color-coded status badges (`COMPLETED`, `RUNNING`, `FAILED`, `STOPPED`), task name, timestamp, and a **View** button.
   - Clicking **View** fetches `GET /runs/:id/events` and calls `loadEvents(pastEvents)` in `useRun.ts`. Because `useRun` computes `events.reduce(applyEvent, initialState)`, the entire React Flow graph and Message Log instantly reconstruct the historical run! Clicking **← Back to Live Debate** resets the view.
6. **Custom Agent Library & Role Assignment (`apps/web/src/components/AgentModal.tsx` & `App.tsx`):**
   - Full modal dialog to create, edit (`PUT`), and delete (`DELETE`) custom agents stored in SQLite, choosing from live Ollama models.
   - Header dropdown selectors in `App.tsx` allow assigning any saved custom agent to play **Pro**, **Con**, or **Judge** before starting a debate, dynamically updating node labels on the canvas and passing custom system prompts and models into `runDebate()` and `chat()`.
7. **Two Full Thesis Chapters Written (`docs/thesis/`):**
   - **Requirements Chapter (`docs/thesis/requirements.md`):** User personas (Computing Student Learner & Agent Workflow Developer), Functional Requirements (FR1–FR6), Non-Functional Requirements (NFR1–NFR5), MoSCoW prioritization table, and Multi-User extensibility justification.
   - **Architecture Chapter (`docs/thesis/architecture.md`):** 4-layer architecture overview diagram, `AgentEvent` contract & turn lifecycle, Inversion of Control orchestrator design, Pure Reducer client state proof, SQLite ER schema & JSON payload justification, Mermaid end-to-end sequence diagram, and technology justification table.

---

## 3. Complete Repository Map & File-by-File Architecture

```text
uni-project/
├── packages/
│   └── shared/
│       └── src/events.ts              # Shared TypeScript types: AgentEvent (9 variants), Agent, ClientMessage
├── apps/
│   ├── server/
│   │   ├── data.db                    # Local SQLite database file (agents, runs, events)
│   │   ├── drizzle.config.ts          # Drizzle Kit configuration pointing to src/db/schema.ts
│   │   └── src/
│   │       ├── index.ts               # Express REST API (/runs, /agents, /models) + WebSocket (/ws) + DB persistence
│   │       ├── events.ts              # DistributiveOmit helper + makeEvent(runId, event) factory
│   │       ├── db/
│   │       │   ├── schema.ts          # Drizzle SQLite table definitions: agents, runs, events
│   │       │   └── index.ts           # better-sqlite3 connection + Drizzle instance export
│   │       ├── llm/
│   │       │   └── ollama.ts          # Streaming HTTP client for Ollama POST /api/chat (supports per-agent model)
│   │       └── orchestrator/
│   │           └── debate.ts          # Decoupled 3-round Pro/Con/Judge orchestrator emitting AgentEvents
│   └── web/
│       ├── vite.config.ts             # Vite dev server + WebSocket proxy (/ws -> ws://localhost:3000)
│       └── src/
│           ├── main.tsx               # React root mount
│           ├── runState.ts            # Pure event reducer: applyEvent(state, event) -> RunState
│           ├── useRun.ts              # Hook managing WebSocket lifecycle, events[], state, start(), loadEvents()
│           ├── App.tsx                # Main dashboard: header controls, role pickers, ReactFlow canvas, edge builder
│           └── components/
│               ├── AgentNode.tsx      # Custom React Flow node: status badge, token counter, live speech bubble
│               ├── MessageLog.tsx     # Right sidebar: chronological messages, hover/click edge synchronization
│               ├── PastRuns.tsx       # Bottom drawer: SQLite run history table + one-click historical replay
│               └── AgentModal.tsx     # Modal for creating, editing, and deleting custom agents in SQLite
├── learning/                          # Weeks 1–3 foundational prototypes (kept intact as learning history)
│   ├── ollama.ts                      # Week 1: Raw streaming Ollama client
│   ├── 01-hello-llm.ts                # Week 1: Stateless messages array & prompt/temperature experiments
│   ├── 02-agent-with-tools.ts         # Week 2: ReAct tool-calling loop (calculate, dates, save_note)
│   ├── 03-debate.ts                   # Week 3: Terminal 3-agent debate with perspective shifting
│   ├── crewai/crew.py                 # Week 3: CrewAI benchmark (sequential vs hierarchical failure analysis)
│   └── langgraph/agent.py             # Week 3: LangGraph StateGraph benchmark
└── docs/
    ├── PROJECT.md                     # Project proposal, research question, scope, evaluation plan
    ├── ROADMAP.md                     # Weekly (Oct–Dec) and monthly (Dec–Apr) milestones
    ├── DIARY.md                       # Chronological engineering log of bugs, experiments, and decisions
    ├── comparison_papers.md           # Deep comparison of CAMEL, Generative Agents, ChatDev, MetaGPT, AutoGen
    ├── week-3.md .. week-7.md         # Weekly guides and completed literature review
    └── thesis/
        ├── requirements.md            # Drafted Thesis Chapter: Requirements (Personas, FR, NFR, MoSCoW)
        └── architecture.md            # Drafted Thesis Chapter: Architecture (Diagrams, Event Sourcing, DB)
```

---

## 4. End-to-End Execution Trace: What Happens When You Click "Start Debate"?

Understanding this exact 10-step chain means you understand every single line of your stack:

1. **User Action (`App.tsx`):** You type a topic (e.g., `"AI will replace software engineers"`), optionally select custom agents from the Pro/Con/Judge dropdowns, and click **Start Debate** (`handleStart`).
2. **WebSocket Handshake (`useRun.ts`):** `start(topic, agents)` clears `events` to `[]`, opens a WebSocket to `ws://localhost:5173/ws` (which Vite proxies to `ws://localhost:3000/ws`), and sends:
   ```json
   { "type": "start_run", "topic": "...", "proId": "...", "conId": "...", "judgeId": "..." }
   ```
3. **Database Initialization (`apps/server/src/index.ts`):**
   - The server receives `"start_run"`, generates `runId = crypto.randomUUID()`, fetches any custom agent configs (`name`, `role`, `model`) from the `agents` table in `data.db`, and inserts a row into `runs` with `status: "running"`.
4. **Orchestrator Invocation (`debate.ts`):**
   - Server calls `runDebate(runId, msg.topic, emit, customAgents)` with `ROUNDS = 3`.
   - `runDebate` immediately emits `run_started` with `agentIds: ["pro", "con", "judge"]`.
5. **Dual Persistence + Broadcast (`index.ts`):**
   - Inside the `emit(event)` callback passed to `runDebate`:
     1. The event is inserted into the SQLite `events` table with `seq: seq++` and `payload: JSON.stringify(event)`.
     2. The event is sent over the WebSocket (`socket.send(JSON.stringify(event))`).
6. **Agent Turn & Perspective Construction (`debate.ts`):**
   - Round 1 starts: `runDebate` emits `agent_started` (`agentId: "pro"`).
   - In the browser, `applyEvent` transitions `state.agents.pro.status` to `"thinking"`. `AgentNode.tsx` lights up with a glowing cyan border and displays `"Thinking…"`.
   - `messagesFor(Pro, turns, topic)` constructs the `Message[]` list from `Pro`'s perspective (its own past turns as `assistant`, opponent turns as `user`).
7. **Live Token Streaming (`ollama.ts` $\rightarrow$ `debate.ts` $\rightarrow$ `App.tsx`):**
   - `chat()` sends `POST /api/chat` with `stream: true` to local Ollama.
   - As each NDJSON line arrives, `onToken(piece)` fires `emit(makeEvent(runId, { type: "llm_token", agentId: "pro", text: piece }))`.
   - Each token is saved to SQLite (`events` table) and pushed over WebSocket.
   - In the browser, `applyEvent` appends `event.text` to `state.agents.pro.liveText`. `AgentNode.tsx` shows the words appearing live inside Pro's node!
8. **Turn Completion & Edge Animation (`debate.ts` $\rightarrow$ `App.tsx`):**
   - When Ollama finishes the turn (`done: true`), `chat()` returns `promptTokens`, `outputTokens`, and `durationMs`.
   - `runDebate` emits three events in sequence:
     - `llm_response` $\rightarrow$ updates `state.agents.pro.tokens` and records `lastResponse`.
     - `message_sent` (`fromAgentId: "pro"`, `toAgentId: "con"`, `content: proText`) $\rightarrow$ adds card to `MessageLog.tsx` and sets `state.activeEdge = { from: "pro", to: "con" }`. `App.tsx` animates the `pro->con` edge in cyan for 1.5 seconds and increments its badge (`1 msg`, `2 msgs`, `3 msgs`).
     - `agent_finished` $\rightarrow$ sets `state.agents.pro.status` to `"done"` (green border).
9. **3 Rounds + Judge Verdict:**
   - Steps 6–8 repeat for `Con` (Round 1), `Pro` & `Con` (Round 2), and `Pro` & `Con` (Round 3).
   - Then `Judge` starts (`agent_started`), reads the full 6-turn transcript, streams its verdict (`llm_token`), emits `message_sent` to `"all"` (which fans out to both `judge->pro` and `judge->con` edges), and finishes (`agent_finished`).
10. **Run Finalization (`index.ts`):**
    - `runDebate` emits `run_finished` (`status: "completed"`).
    - Server updates `runs` in SQLite: `SET status = "completed", finished_at = Date.now()`.
    - `PastRuns.tsx` automatically refreshes (`useEffect` watching `isLive`), displaying the newly completed run in the bottom history panel ready for instant replay.

---

## 5. Summary of Key Engineering Decisions & Thesis Defenses

When your supervisor or examiners ask *"Why did you build it this way?"*, here are your exact, evidence-backed answers:

| Question | Your Answer & Empirical Evidence |
| :--- | :--- |
| **Why write a custom orchestrator instead of using CrewAI or LangGraph?** | In Week 3 benchmarks with `qwen3:8b`, CrewAI's hierarchical manager silently skipped the Writer agent, hallucinated facts, used $5\times$ more tokens, and still reported `"Task Completed"`. LangGraph models Python function state rather than agent-to-agent dialogue and requires cloud LangSmith auth. Writing a custom event-emitting orchestrator guarantees 100% step-level observability and zero silent failures. |
| **Why use an append-only `AgentEvent` stream instead of saving final messages?** | Saving only final messages loses timing, token streams, intermediate failures, and turn ordering. With an append-only event stream and a pure reducer (`applyEvent`), the **exact same data structure** drives the live graph, the message log, persistent storage, and historical replay. |
| **Why save every `llm_token` event in SQLite?** | While one debate generates ~450–600 `llm_token` rows, local disk storage is negligible (~50 KB per run), and saving token-level events makes runs 100% reproducible down to the token—enabling the January timeline scrubber to scrub forward and backward through live text generation. |
| **Why store `payload` as a JSON string in the `events` table?** | `AgentEvent` is a discriminated union where each event variant has different fields (`fromAgentId`, `promptTokens`, `text`). Storing `payload` as serialized JSON gives relational ordering (`runId`, `seq`, `type`) while allowing new event types (like tool calls or human interrupts) to be added in December–February with **zero database schema migrations**. |
| **Why SQLite + Drizzle ORM?** | SQLite (`better-sqlite3`) requires zero background servers or credentials (`data.db` works out of the box for any student), while Drizzle ORM provides TypeScript compile-time query safety and dialect portability (can swap to PostgreSQL for future multi-user cloud deployment without rewriting queries). |

---

## 6. Week 6 Milestone Tasks & Completed Checklist

**Goal:** Save every run to a database so it survives a restart, build the Past Runs viewer and Custom Agent configuration UI, and write the first two thesis chapters.

| Day | Work | Status |
| --- | --- | --- |
| Mon | Task 1: SQLite + Drizzle setup (`apps/server/src/db/schema.ts`, `index.ts`, `drizzle.config.ts`) | Completed |
| Tue | Task 2: Save runs and events (`POST /runs`, `GET /runs`, `GET /runs/:id/events`, orphan recovery) | Completed |
| Wed | Task 3: Past runs list (`PastRuns.tsx`) and Custom Agent CRUD form (`AgentModal.tsx` + role pickers) | Completed |
| Thu | Task 4: Requirements chapter draft (`docs/thesis/requirements.md`) | Completed |
| Fri | Task 5: Architecture chapter draft (`docs/thesis/architecture.md`) | Completed |
| Sat | Task 6: Review and diary (`docs/DIARY.md` Week 6 entry) | Completed |

### End of Week 6 Checklist
- [x] SQLite + Drizzle, three tables (`agents`, `runs`, `events` in `apps/server/src/db/schema.ts`)
- [x] Every event saved; runs survive a restart (`apps/server/src/index.ts`)
- [x] Past runs list opens an old run as a graph (`apps/web/src/components/PastRuns.tsx`)
- [x] Create-agent form, used by the debate (`apps/web/src/components/AgentModal.tsx` & `App.tsx`)
- [x] Requirements chapter: full draft (`docs/thesis/requirements.md`)
- [x] Architecture chapter: full draft with diagrams (`docs/thesis/architecture.md`)
- [x] Diary entry: the `llm_token` decision and why (`docs/DIARY.md`)
- [x] Tick the tasks in the [roadmap tracker](https://claude.ai/artifact/SNVKp1dvsXVKaEBKAx5k5p)
