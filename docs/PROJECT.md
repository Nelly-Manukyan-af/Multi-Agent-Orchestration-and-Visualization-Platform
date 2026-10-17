# Multi-Agent Orchestration and Visualization Platform

Oct 10, 2026 · @Nelly

This project builds a web platform where users define a team of AI agents, give it a task, and watch the agents collaborate live as an interactive graph, with every message, tool call and decision inspectable and replayable.

## Problem

Multi-agent AI systems are hard to understand because their behaviour is hidden in long text logs. In these systems, several large language model (LLM) agents with different roles work together on a task. Frameworks such as AutoGen, CrewAI and LangGraph make these systems easy to build. Seeing what actually happened during a run is still difficult.

When a run goes wrong, developers and learners have to read thousands of lines of prompts and responses to answer simple questions:

- Which agent made the decision that led to the result?
- Why did two agents keep repeating the same exchange?
- Which tool call failed, and what did the agent do next?
- How many tokens and how much time did each agent use?

There is a need for a tool that makes agent collaboration visible, interactive and easy to configure, without writing code.

## Aim and objectives

The aim is to design, build and evaluate a web platform for configuring, running and visualizing teams of LLM agents.

1. **Configure agents** with a name, role, instructions, model and allowed tools, through a user interface.
2. **Compose teams** in a drag-and-drop graph editor, using three interaction patterns: sequential pipeline, manager and workers, and group discussion.
3. **Visualize runs live**: show agents as graph nodes, highlight the active agent and animate messages between agents as they happen.
4. **Inspect every step**: the exact prompt, response, tool inputs and outputs, token count and duration.
5. **Store and replay runs** from an event log, step by step on a timeline.
6. **Run at zero cost** on local open-weight models, so any student can use it.
7. **Evaluate** whether live visualization helps users understand and debug agent behaviour better than text logs.

Research question: *Does an interactive graph visualization help users understand and debug multi-agent LLM systems faster and more accurately than text logs?*

## Scope

| Area | In scope (core) | Stretch, if time allows | Out of scope |
| --- | --- | --- | --- |
| Agents | Role, instructions, model, tools | Agents that create sub-agents | Training or fine-tuning models |
| Teams | Sequential, manager and workers, group discussion | Custom routing rules | Hundreds of agents at once |
| Visualization | Live graph, message log, inspector, replay timeline | Side-by-side run comparison, metrics dashboard | 3D or VR views |
| Control | Start and stop a run | Pause, edit a message, approve tool calls | Multi-user collaboration |
| Models | Local models through Ollama | Optional cloud model providers | Paid APIs as a requirement |
| Tools for agents | Web search, calculator, read and write notes | Code execution in a sandbox | Access to the user's real accounts |

The platform will ship with demo templates, including a **Debate** team (Pro, Con, Judge) and a **Research and Report** team (Planner, Researcher, Writer, Critic).

## Architecture

The system is built around an event log: every agent action is saved as an event and streamed to the browser.

&#91;embedded content: system architecture · browser, server, local services\]

The orchestrator decides which agent acts next. The agent runtime calls the local model and tools. Each step becomes an event (for example `message_sent` or `tool_called`) that is stored in SQLite and pushed to the browser. Live view, replay and metrics all read the same events.

## Related work

Existing tools are either frameworks for building agents in code, or monitoring tools that show what happened after a run. Few combine no-code team design, live visualization and replay in one tool that runs for free on a laptop.

| Tool | Type | Strengths | Gaps this project addresses |
| --- | --- | --- | --- |
| [AutoGen / AutoGen Studio](https://github.com/microsoft/autogen) | Framework + UI | Conversation-based multi-agent teams, no-code team builder | Limited live graph view of who talks to whom |
| [CrewAI](https://github.com/crewAIInc/crewAI) | Framework | Role-based agents, simple to define | Visualization mostly through paid hosted tools |
| [LangGraph](https://github.com/langchain-ai/langgraph) + LangGraph Studio | Framework + IDE | Graph-based workflows, step debugging | Aimed at developers writing code |
| [Langfuse](https://github.com/langfuse/langfuse) | Monitoring | Open-source traces, cost and latency | Shows traces as trees and lists, not agent interaction |
| LangSmith, AgentOps | Monitoring | Detailed traces and session replay | Hosted services, not focused on teaching or design |

The project will also draw on research on agent behaviour: **ReAct** (Yao et al., 2022), **CAMEL** (Li et al., 2023), **Generative Agents** (Park et al., 2023), **ChatDev** (Qian et al., 2023), **MetaGPT** (Hong et al., 2023) and **AutoGen** (Wu et al., 2023).

This comparison is a first version. It will be checked against each tool's current features during the literature review.

## Technology

The whole system is written in TypeScript, so the frontend and backend share one language and one set of data types.

| Layer | Choice | Reason |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite | Widely used, fast development |
| Graph view | React Flow | Ready-made node graphs, drag-and-drop and animated edges |
| Backend | Node.js, Fastify, WebSockets | Streams events to the browser as they happen |
| Model access | Vercel AI SDK | One interface for chat and tool calling across model providers |
| Models | Ollama with Qwen 3 8B | Free, runs locally on a 16 GB laptop, supports tool calling |
| Storage | SQLite with Drizzle ORM | No server to install, typed queries |
| Packaging | pnpm workspaces, Docker Compose | One repository; the demo starts with one command |

The orchestration engine (the part that decides which agent speaks next and passes messages) is written for this project rather than taken from a framework. That makes it a core contribution of the work and keeps every step observable.

## Evaluation

The platform will be evaluated with a small user study and with technical measurements.

**User study (8–12 participants, computing students).** Each participant works on prepared runs that contain a planted problem, such as an agent stuck in a loop or a failed tool call. They find the cause once with the graph visualization and once with a plain text log, in a balanced order. Measures:

- Time to find the cause, and whether the answer is correct
- System Usability Scale (SUS) questionnaire score
- Short interview about what helped and what was confusing

**Technical measurements.**

- Delay between an agent event and its appearance in the browser
- Run time and tokens per run for each demo team
- Replay accuracy: a replayed run shows the same events in the same order as the live run

**Case studies.** Two or three demo teams are documented with screenshots and a walk-through of their runs.

## Timeline

A working prototype, the literature review and the design are due at the 40% checkpoint on Dec 1, 2026. The finished system and thesis are due in April 2027 (exact date to be confirmed, Apr 1, 2027 used for planning).

| Period | Milestone | Deliverable |
| --- | --- | --- |
| Oct 12–25 | LLM basics and tool calling on local models | Single agent with tools, proposal approved |
| Oct 26–Nov 8 | Multi-agent patterns, event streaming | Three-agent debate streamed to the browser |
| Nov 9–22 | Live graph view, run storage | Prototype with live visualization |
| Nov 23–Dec 1 | **40% checkpoint** | Prototype demo, literature review, requirements, architecture |
| December | Team builder, three interaction patterns | Teams designed in the UI |
| January | Inspector, run history, replay timeline | Full core feature set |
| February | One stretch feature, demo templates | Feature-complete system |
| March | User study and measurements | Evaluation results |
| April | Thesis writing, presentation | **Final submission** |

## Risks

| Risk | Likelihood | Impact | Fallback |
| --- | --- | --- | --- |
| Local models are slow or give weak answers | Medium | Medium | Use smaller tasks and short prompts; optionally use a free cloud tier for demos |
| Small models call tools unreliably | Medium | Medium | Validate tool calls and retry; keep demo tools simple |
| Scope grows beyond the time available | High | High | Core features first; stretch features only after February |
| New technologies take longer to learn | Medium | Medium | Learning tasks are scheduled in the first six weeks |
| Too few participants for the user study | Low | Medium | Recruit from classmates early; a smaller study with interviews still gives findings |

