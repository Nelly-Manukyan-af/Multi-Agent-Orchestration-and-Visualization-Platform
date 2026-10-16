# Multi-Agent Orchestration and Visualization Platform

Final year project. A web platform to define a team of AI agents, give it a task, and watch the agents
collaborate live as a graph, with every step inspectable and replayable.

## Layout

| Folder | What | When |
| --- | --- | --- |
| `docs/` | [Roadmap](docs/ROADMAP.md) and detailed weekly plans | Whole project |
| `learning/` | Small exercises, one per week | Weeks 1–3 |
| `packages/shared/` | Types shared by server and web (the event model) | Started now, grows with the project |
| `apps/server/` | Orchestrator, API, WebSocket, database | Weeks 4–6 |
| `apps/web/` | React UI with the live graph | Weeks 5–6 |

## Setup

Needs Node.js 24+ and [Ollama](https://ollama.com) (free, runs models on your laptop).

```sh
brew install ollama
brew services start ollama   # runs Ollama in the background, also after restart
ollama pull qwen3:8b         # ~5 GB, once
npm install
npm run hello                # week 1: first LLM call
npm run agent                # week 2: agent with tools
```

Use a different model with `MODEL=llama3.1:8b npm run hello`.
