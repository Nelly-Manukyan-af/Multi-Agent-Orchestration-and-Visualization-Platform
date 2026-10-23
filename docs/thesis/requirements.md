# Requirements Chapter

## 1. Introduction and User Profiles

Multi-agent systems powered by Large Language Models (LLMs) are transitioning from theoretical research into practical software engineering. However, following, debugging, and understanding the execution of multiple autonomous agents remains notoriously difficult. Current frameworks typically output raw terminal logs, upload execution traces to proprietary third-party cloud servers, or offer visual representations disconnected from actual message exchanges.

This project addresses these challenges by developing a 100% local, real-time, interactive graph-based observation and debugging platform for multi-agent LLM systems.

To establish grounded requirements, two primary user personas were identified based on exploratory evaluations of existing industry tools (AutoGen Studio, CrewAI, LangGraph Studio):

### 1.1 Primary Persona: Computing Student (Learner)
* **Profile**: An undergraduate or graduate student studying computer science, artificial intelligence, or software engineering.
* **Goals**:
  - Understand how individual LLM prompts and agent roles compose into multi-agent workflows.
  - Visually follow who is speaking to whom and observe decision-making in real time.
  - Experiment with multi-agent orchestration locally on a personal laptop without cloud API keys, monthly subscriptions, or financial barriers.
* **Pain Points with Existing Tools**:
  - *Tool Complexity*: Frameworks like LangGraph Studio require configuring accounts, managing Python virtual environments, and generating cloud API keys before displaying a basic interface.
  - *Opaque Text Output*: Terminal outputs (e.g., standard CrewAI logs) scroll too rapidly, mixing debugging metadata with actual dialogue, making turn-taking patterns indistinguishable.
  - *Cost Anxiety*: Cloud-based API calls (OpenAI, Anthropic) introduce unpredictable token expenses during learning and iterative testing.

### 1.2 Secondary Persona: Agent Workflow Developer (Practitioner)
* **Profile**: A software developer building or maintaining multi-agent systems.
* **Goals**:
  - Quickly diagnose failure modes (e.g., role hallucination, infinite agent loops, prefix echoing, reasoning breakdown).
  - Inspect exact execution metrics per turn (input prompt tokens, output generated tokens, response latency).
  - Persist historical runs and replay past executions to verify consistency and identify regressions.
* **Pain Points with Existing Tools**:
  - *Superficial Graph Views*: AutoGen Studio displays static diagrams where graph nodes represent raw message count rather than active participants, offering no per-node interactive inspection.
  - *Misleading Completion Statuses*: In tools like CrewAI, an agent workflow can fail internally (such as a manager ignoring delegation or fabricating unprovided facts), yet the CLI reports `"Task Completed"`, obscuring errors from the developer.
  - *Loss of State on Reload*: Many existing open-source web interfaces wipe past runs when restarted, preventing longitudinal comparison of agent behaviors.

---

## 2. Functional Requirements (FR)

The system must deliver the following concrete capabilities:

### FR1: Agent Configuration and Customization
* **FR1.1**: The user must be able to define custom agents with a **Name**, a **Role / System Prompt** (defining behavior, stance, and constraints), and an **Assigned LLM Model**.
* **FR1.2**: The user must be able to view, edit, and delete existing agent definitions through a graphical user interface without modifying source code or raw JSON configuration files.
* **FR1.3**: The system must automatically detect and populate available local models installed via the local inference engine (Ollama).

### FR2: Multi-Agent Topologies
* **FR2.1 (Group Discussion / Debate)**: The platform must support round-based multi-agent discussions where participating agents react to previous statements and a judge agent synthesizes a conclusion.
* **FR2.2 (Role Assignment)**: Before initiating a run, the user must be able to assign configured agents to specific roles (e.g., Pro, Con, Judge).
* **FR2.3 (Extensibility to Pipeline & Hierarchical)**: The orchestrator design must cleanly separate agent execution from event streaming, providing architectural compatibility for sequential pipelines and manager-worker delegation patterns.

### FR3: Real-Time Live Graph Visualization
* **FR3.1**: Participating agents must render as interactive nodes on an infinite-canvas graph layout.
* **FR3.2**: Node state must visibly reflect the active agent status in real time:
  - `idle`: Slate neutral styling, indicating waiting state.
  - `thinking`: Cyan border and glow effect, indicating LLM inference in progress.
  - `done`: Green styling, indicating turn or session completion.
  - `error`: Red styling, indicating runtime failure or communication crash.
* **FR3.3**: The node of an actively reasoning agent must stream its output tokens in real time within a dedicated speech bubble.
* **FR3.4**: Directed edges between nodes must dynamically animate (e.g., pulsed dash animations) when an agent sends a message to another agent.
* **FR3.5**: Edges between the same pair of agents must aggregate communication frequency (e.g., displaying message counts `3 msgs`) rather than cluttering the canvas with duplicate overlapping lines.

### FR4: Dual-View Structured Message Logging and Bidirectional Interaction
* **FR4.1**: A chronological message feed must run concurrently alongside the graph canvas, displaying speaker badges, recipient targets, token counts, execution duration (seconds), and full message text.
* **FR4.2 (Hover Highlighting)**: Hovering over a message entry in the log must highlight the corresponding directed communication edge on the graph canvas.
* **FR4.3 (Click Inspection)**: Clicking an edge in the graph canvas must automatically locate and highlight the latest corresponding message in the message feed.

### FR5: Run Persistence and Historical Replay
* **FR5.1**: Every run session must be permanently saved to local storage upon initiation, tracking start time, topic, status, and completion timestamp.
* **FR5.2**: Every discrete event emitted during a run (`run_started`, `agent_started`, `llm_token`, `llm_response`, `message_sent`, `agent_finished`, `run_finished`) must be saved with a strict sequential ordering (`seq`).
* **FR5.3**: The user must be able to view a list of all historical runs, inspect their outcome badges (`COMPLETED`, `RUNNING`, `FAILED`, `STOPPED`), and select any past run to reconstruct its full graph and message history without executing model calls.
* **FR5.4**: The system must recover gracefully from server interruptions, automatically marking incomplete runs as `STOPPED` upon server reboot.

### FR6: 100% Local Execution
* **FR6.1**: All model inference must execute locally via Ollama (`qwen3:8b` or user-specified local models).
* **FR6.2**: The entire platform (server, database, and client) must function without internet connectivity, third-party cloud telemetry, or paid API keys.

---

## 3. Non-Functional Requirements (NFR)

The system must satisfy the following qualitative and technical constraints:

### NFR1: Event Latency and Responsiveness
* Over a local WebSocket connection, the delay between an event being emitted by the orchestrator and rendered on the browser canvas must not exceed **200 ms** (experimentally verified at 1–4 ms on localhost).
* The user interface must maintain 60 frames per second during node panning, zooming, and edge animation, even while streaming text chunks.

### NFR2: Zero Operational Cost
* The application must require no paid software licenses, cloud database hosting, or external API credits. Setup and execution must be entirely free.

### NFR3: State Reproducibility and Event Sourcing
* Client state must be derived deterministically through a pure reducer function:  
  $$\text{State}_{t} = \text{applyEvent}(\text{State}_{t-1}, \text{Event}_t)$$
* Replaying saved events from the database must yield the exact visual and structural state observed during live execution.

### NFR4: Usability and Zero-Configuration Setup
* A first-time user with Node.js and Ollama installed must be able to start the entire environment with two standard commands (`npm run dev -w apps/server` and `npm run dev -w apps/web`) and trigger their first debate in under **5 minutes** without editing configuration files.
* Dark-mode aesthetics with high-contrast status colors (cyan, slate, green, red) must ensure readability across varying screen resolutions and lighting environments.

### NFR5: Clean Architecture and Separation of Concerns
* The agent orchestrator must have zero direct dependency on WebSocket transport, database drivers, or frontend UI components. The orchestrator communicates strictly by invoking a generic callback: `emit(event: AgentEvent)`.
* Storage and visualization layers subscribe to emitted events independently without coupling.

---

## 4. MoSCoW Prioritization Matrix

To guide development across the academic timeline (October to April) and guarantee a functioning demo for the 40% checkpoint (Week 7 / December 1), requirements are prioritized according to the MoSCoW methodology:

| Category | Requirement Code | Description | Target Milestone |
| :--- | :--- | :--- | :--- |
| **Must Have** | **FR1.1 – FR1.3** | Agent configuration & editing in UI (Name, Role, Model) | Week 6 (Completed) |
| | **FR2.1 – FR2.2** | Multi-agent group debate topology with role selection | Week 6 (Completed) |
| | **FR3.1 – FR3.5** | Real-time live graph with status badges, streaming speech, animated edges | Week 5 (Completed) |
| | **FR4.1 – FR4.3** | Side-by-side Message Log with bidirectional graph highlight | Week 5 (Completed) |
| | **FR5.1 – FR5.4** | Run & event persistence in SQLite; past run reconstruction | Week 6 (Completed) |
| | **FR6.1 – FR6.2** | 100% local Ollama execution with zero API keys | Week 1–4 (Completed) |
| | **NFR1 – NFR5** | <200ms latency, zero cost, pure reducer reproducibility | Week 4–6 (Completed) |
| **Should Have** | **FR2.3** | Additional topologies: Sequential pipeline & Manager-Worker | December |
| | **Step Inspector**| Modal inspecting exact prompt, system message, tool calls, and duration | January |
| | **Interactive Replay** | Timeline scrubber to step forward/backward through a completed run | January |
| | **Team Builder UI** | Drag-and-drop agent canvas for custom graph topologies | December |
| **Could Have** | **Run Comparison** | Side-by-side split comparison of two runs on the same topic | February |
| | **Human-in-the-Loop** | Pausing an in-flight run and editing an agent's response before resume | February |
| | **Export Traces** | Exporting run histories and event streams as JSON/CSV | February |
| **Won't Have (This Thesis Phase)** | **Multi-User Accounts & Auth** | User authentication, permission roles, and tenant isolation | Planned for Post-Thesis / Future Work |
| | **Cloud-Hosted Deployment** | Hosted SaaS infrastructure and cloud-managed database clusters | Planned for Post-Thesis / Future Work |
| | **Model Training & Fine-Tuning** | Training custom LLM weights (focus is solely orchestration & tracing) | Not planned |

---

## 5. Architectural Extensibility & Future Multi-User Roadmap

In MoSCoW analysis, classifying **Multi-User Accounts** as *"Won't Have"* for the thesis scope is an intentional, strategic prioritization rather than an architectural limitation:

1. **Research Focus and Evaluation Scope**:
   The core research question of this thesis evaluates whether a synchronized graph-and-log visual interface improves human comprehension and debugging of multi-agent dynamics compared to traditional text logs. The upcoming user study (March) tests individual participants running localized benchmarks. Adding authentication, password hashing, JWT cookies, and user management tables during this phase would consume engineering effort without advancing the core visual cognitive research question.

2. **Built-in Architectural Extensibility**:
   While scoped as single-tenant for the initial local evaluation, the platform was specifically architected to make transitioning to a multi-tenant, multi-user system straightforward:
   - **Data Layer Portability via Drizzle ORM**: Because all queries are written using Drizzle ORM rather than SQLite-specific raw SQL, the persistence layer is dialect-agnostic. Migrating to PostgreSQL requires swapping the database driver without modifying application queries.
   - **Schema Scoping**: Multi-user tenancy requires adding a `users` table and appending a `user_id` foreign key reference to `runs` and `agents` (`runs.user_id = users.id`).
   - **Channelized Real-Time WebSockets**: In the current single-user implementation, events are emitted to open connections. In a multi-user environment, WebSockets can be scoped to user-specific or run-specific subscription channels (rooms) with minimal refactoring.

This clear separation ensures rapid, unblocked progress during the thesis while demonstrating forward-thinking engineering design in the academic report.

---

## 6. Summary

By establishing clear user personas and defining explicit functional and non-functional requirements, this chapter anchors the design of the platform. The MoSCoW prioritization verifies that all **Must-Have** requirements are fully operational ahead of the 40% checkpoint deadline, providing a solid, verified foundation for the architectural implementation detailed in the next chapter.
