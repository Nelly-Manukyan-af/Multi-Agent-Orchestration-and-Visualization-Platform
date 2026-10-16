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
  - Best thing: very little code for a working team; clear role/goal/task idea
  - Most missing: any visual view of the team or the run; no way to look back at a run