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
