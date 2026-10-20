# Development diary

Write 3–5 lines after every work session: what you did, what broke, what you decided and why.
This becomes the raw material for the thesis chapters.

## 2026-10-10

- Chose the topic scope: multi-agent orchestration + live visualization.
- Chose TypeScript for the whole stack (already know it; one language for frontend and backend).
- Chose Ollama + Qwen 3 8B so the project costs nothing to run.
- Set up the repository structure and the first two learning exercises.
- First bug: the agent sometimes returned an empty answer. Cause: the task needed "days between two dates",
  and there was no tool for it, so the 8B model produced nothing usable. Fix: added a `days_between` tool and
  made the loop ask again on an empty reply. Lesson for the thesis: small local models need precise tools,
  and the platform must show and handle empty or failed steps.

## 2026-10-11

- Run npm run hello and its exercises
- Read Building Effective Agents (Anthropic)
- Understand messages, system prompts, tokens, temperature and the context window
- no need to send the project proposal
- understand ReAct
- write a tool


## 2026-10-15 (16)
- read all papers and compared them together
  ### AutoGen Studio
  - Define a team: drag-and-drop + forms (JSON optional)
  - Live view while running: chat log + optional message-flow graph (adds a node per message)
  - Inspect one step: message text + tokens; no exact prompt, no timing; graph nodes not clickable
  - Replay a finished run? Static graph + log after reload; no step-by-step replay
  - Worked with a local 8B model? Yes, slow (~1 msg/min); /no_think ignored; agents ignore some rules
  - Best thing: easy no-code setup, graph exists
  - Most missing: step-by-step replay, per-step details, clear view of why a run stopped
  - Added a tool-using agent (scorekeeper + calculator) from the UI. Needed JSON for `function_calling: true`,
    and the agent box shows "0 Tools" even when it has one. The tool call itself is shown clearly (name, arguments, result).
  ### CrewAI
  - Setup: own venv (`~/venvs/crewai`, CrewAI 1.15) so it can't break AutoGen Studio; Ollama works built in (`ollama/qwen3:8b`)
  - Built `learning/crewai/crew.py`: researcher (5 facts) → writer (one paragraph), sequential
  - Define a team: Python code only (agent = role + goal + backstory; task = description + expected output + agent)
  - Live view while running: coloured boxes in the terminal per task/agent; with `verbose=False`, only the final answer
  - Inspect one step: each agent's final answer and total tokens; no exact prompt, no per-step timing
  - Replay a finished run? No, the log is gone once the terminal scrolls
  - Worked with a local 8B model? Yes, first try; fast (whole run 46 s, 4 model calls, 2,372 tokens)
  - Tried `Process.hierarchical`: CrewAI adds a hidden "Crew Manager" agent that gets every task and passes work to
    the others with two tools ("Delegate work to coworker", "Ask question to coworker"). Who did what is only visible in the log.
    Run on "colombia": task 1 → manager delegated to Researcher (good), but then returned "The task is complete…" as its
    answer instead of the facts. Task 2 → manager wrote the paragraph itself; the Writer never ran. The paragraph has facts
    the Researcher never gave (Ecuador, bananas, oil). Cost: 12,750 tokens / 12 model calls vs 2,372 / 4 for sequential (~5×).
    The end summary still says "Task Completed", so nothing warns you about any of this.
  - Tracing (`CREWAI_TRACING_ENABLED=true`): the model still runs locally, but a copy of the whole run (prompts, answers,
    tokens) is uploaded to app.crewai.com. Without login you get a temporary link. The viewer shows:
    - a tree: crew → task → agent → model call, with tokens and start time + duration for each
    - per model call: the exact system + user messages and the reply (this is what the terminal hides)
    - no graph of who talked to whom, no step-by-step replay, only online (not local, needs internet)
    - Second hierarchical run: the manager did BOTH tasks itself, no delegation at all. Same code, different
      behaviour each run, and the trace makes this visible only if you open the tree.
  - Run from a script without a normal terminal: tracing on but no link printed; it only appeared in an interactive terminal

## 2026-10-17
  ### LangGraph Studio
  - Setup: own venv (`~/venvs/langgraph`), `learning/langgraph/` (agent.py + langgraph.json + .env), `langgraph dev`.
    Needs a free LangSmith account + API key; Studio UI is on smith.langchain.com, but the graph and model run locally.
    With `LANGSMITH_TRACING=false` a yellow "API key is missing" banner stays on screen (misleading, the key is set)
  - Define a team: Python code only (nodes = functions, edges = order, shared `State`)
  - Live view while running: YES, the graph diagram highlights the running node, and the output streams word by word
  - Inspect one step: each step shows exactly what it changed in the state (`facts`, `paragraph`); hovering a step
    highlights its node. No exact prompt and no tokens here (those are only in the LangSmith trace, which I turned off)
  - Replay / time travel: YES. Edit the researcher's `facts` → Fork → only the writer re-runs. Branches are kept
    ("Fork 3 of 3", arrows to switch). Test: fake fact "purple dragon called Pedro" → the writer used it without question
  - Breakpoints: Interrupts menu, Before/After per node
  - Errors: empty topic → red "Error" label on the node + `KeyError('topic')` in the step list
  - Worked with a local 8B model? Yes, fast (~20 s per run) with `ChatOllama(reasoning=False)`, which really turns off thinking
  - Best thing: graph + live highlight + edit-and-fork; closest to my platform idea
  - Most missing: graph shows the code structure, not the conversation (no "who said what to whom"); needs an online
    account; you must write code; the form asks for `facts`/`paragraph` as "Required" input even though nodes fill them
  - Best thing: very little code for a working team; clear role/goal/task idea
  - Most missing: any visual view of the team or the run; no way to look back at a run

  ### `learning/03-debate.ts` (Pro, Con, Judge)
  - Built the 3-agent debate loop in TypeScript using `ollama.ts` (`Pro` → `Con` for 2 rounds → `Judge` verdict), streaming tokens and emitting `[event]` lines.
  - **Token growth:** Prompt tokens grew linearly each turn (~50 → 115 → 170 → 230 tokens) because the full debate history is re-sent every turn, while output tokens stayed steady (~50–65 tokens, respecting the 80-word limit).
  - **Bug 1 (prefix echoing):** Because opponent turns are formatted as `"Con: ..."` in `user` messages, `Pro` started its Round 2 reply with `"Pro: ..."`, causing `"Pro: Pro: ..."` in the output. Fix: instructed agents not to prefix their name and stripped `^(Pro|Con):\s*` when saving turns.
  - **Bug 2 (role flipping on Round 1):** On the topic `"people must marry"`, `Pro` argued *against* marriage in Round 1 ("Marrying is not a necessity..."). Cause: the system prompt said *"Reply to your opponent's last point"*, so on Turn 1 (with no opponent turn yet) the 8B model treated the topic itself as the opponent's claim and followed its default alignment bias toward personal freedom. In Round 2, after seeing `Con` argue against marriage, `Pro` flipped back to defending marriage, and the `Judge` gave the win to `Con` for being more consistent.
  - **Fix & thesis lesson:** Strengthened system prompts and the initial user message to explicitly remind the agent of its role (`arguing strictly FOR / AGAINST` as a debate exercise). This matches the *role flipping* failure mode from the CAMEL paper and makes a great example of a "planted problem" for the user study in February/March.

## 2026-10-20
  ### Week 4: Server, Live Events, and WebSocket (`apps/server`)
  - **What I built:**
    - Express HTTP server with `/health`, `/echo`, and static file serving (`apps/server`).
    - Shared event types in `packages/shared/src/events.ts` (`AgentEvent` discriminated union, `ClientMessage`).
    - `DistributiveOmit` type helper and `makeEvent` factory in `apps/server/src/events.ts` to attach `id`, `runId`, and `timestamp`.
    - Event-driven debate orchestrator in `apps/server/src/orchestrator/debate.ts` with `runDebate(runId, topic, emit)`.
    - WebSocket streaming via `ws` on `/ws` pushing JSON-serialized events live to connected clients.
    - Plain HTML test page in `apps/server/public/index.html` with real-time token streaming box, structured event list, and latency tracking.
  - **What broke & bugs fixed:**
    - **`app.listen` vs `server.listen`:** Calling `app.listen()` spun up an isolated HTTP server that bypassed the `server` instance containing the `WebSocketServer` (`wss`). Fixed by switching to `server.listen(PORT, ...)`.
    - **Module resolution (.js vs .ts):** With Node 24 native TypeScript execution, importing `./orchestrator/debate.js` failed with `ERR_MODULE_NOT_FOUND`. Changed import path to `./orchestrator/debate.ts`.
    - **Union type flattening:** A naive `Omit<AgentEvent, "id">` collapsed the discriminated union into shared keys only. Solved using `DistributiveOmit<T, K> = T extends unknown ? Omit<T, K> : never`.
  - **Experiment observations:**
    - **Two tabs at once:** Debates do not cross-talk or mix up. Each WebSocket client has an isolated socket connection; the server passes a socket-scoped `emit` callback into `runDebate`, keeping events strictly separated per connection.
    - **Event delay / latency:** Measured `Date.now() - event.timestamp` in the browser. Over local WebSocket, average latency is 1–4 ms per event, confirming WebSocket push has negligible overhead for live agent tracing.
    - **Ollama mid-run failure:** Stopping Ollama mid-run triggers a fetch rejection that is caught by `try/catch`, immediately emitting `{ type: "run_finished", status: "failed" }`. The browser detects this and highlights the run in red ("Failed"), preventing deceptive "Task Completed" summaries observed in CrewAI.
    - **Token volume:** One standard debate run generates between 450 and 600 `llm_token` events (~50–80 tokens per turn across Pro × 2, Con × 2, and Judge × 1).
  - **For the thesis (Why events instead of just saving the final text?):**
    Saving only the final text treats multi-agent systems as opaque black boxes and loses the entire execution trajectory. An append-only stream of fine-grained events decouples the orchestrator from external consumers: the exact same event stream drives the real-time UI graph, step-by-step post-hoc replay, and quantitative performance metrics without the orchestrator needing any knowledge of the presentation layer. Furthermore, structured events make intermediate errors, latency bottlenecks, and reasoning deviations visible and debuggable.
