# Week 6 · Nov 16–22 · Storage and writing

**Goal:** save every run to a database so it survives a restart, and write the first two thesis chapters.

**Why:** so far, runs disappear when the server restarts or the browser tab closes. This week you add
**SQLite**: every event is saved the moment it happens. Once you have that, **replaying an old run is free**
(just read the events from the database and feed them to the same graph).
You also start writing the thesis now, while the reasons for your choices are fresh in your head.

**Order:** SQLite + Drizzle → save runs → past runs list → agent form → requirements chapter → architecture chapter.

| Day | Work |
| --- | --- |
| Mon | Task 1: SQLite + Drizzle setup |
| Tue | Task 2: save runs and events |
| Wed | Task 3: past runs list and agent form |
| Thu | Task 4: Requirements chapter draft |
| Fri | Task 5: Architecture chapter draft |
| Sat | Task 6: review and diary |

---

## Task 1 · SQLite + Drizzle setup (about half a day)

**SQLite** is a database stored in a single file on disk: no server to install, no passwords, zero configuration.
**Drizzle** is a TypeScript library that lets you define tables in code and gives you full type safety for queries.

1. Install from the project root:

   ```sh
   npm install drizzle-orm better-sqlite3 -w apps/server
   npm install -D drizzle-kit @types/better-sqlite3 -w apps/server
   ```

2. Define the schema in `apps/server/src/db/schema.ts`. You need three tables:

   ```ts
   import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

   export const agents = sqliteTable("agents", {
     id: text("id").primaryKey(),
     name: text("name").notNull(),
     role: text("role").notNull(), // the system prompt
     model: text("model").notNull(), // "qwen3:8b" etc.
     createdAt: integer("created_at").notNull(),
   });

   export const runs = sqliteTable("runs", {
     id: text("id").primaryKey(),
     task: text("task").notNull(), // the debate topic or task
     status: text("status").notNull(), // running | completed | failed | stopped
     startedAt: integer("started_at").notNull(),
     finishedAt: integer("finished_at"),
   });

   export const events = sqliteTable("events", {
     id: text("id").primaryKey(),
     runId: text("run_id").notNull().references(() => runs.id),
     seq: integer("seq").notNull(), // 1, 2, 3... order within this run
     type: text("type").notNull(), // agent_started, message_sent, etc.
     payload: text("payload").notNull(), // JSON string of the whole event
     timestamp: integer("timestamp").notNull(),
   });
   ```

   **Why `payload: text(...)`?** Each event type has different fields (`fromAgentId`, `tokens`, etc.).
   Saving the whole event as a JSON string means you never have to change the database when you add a new event type.

3. Create the database connection in `apps/server/src/db/index.ts`:

   ```ts
   import Database from "better-sqlite3";
   import { drizzle } from "drizzle-orm/better-sqlite3";
   import * as schema from "./schema.js";

   const sqlite = new Database("data.db");
   export const db = drizzle(sqlite, { schema });
   ```

4. Create `apps/server/drizzle.config.ts`:

   ```ts
   import { defineConfig } from "drizzle-kit";

   export default defineConfig({
     schema: "./src/db/schema.ts",
     out: "./drizzle",
     dialect: "sqlite",
     dbCredentials: { url: "data.db" },
   });
   ```

5. Push the schema into the database: `npx drizzle-kit push -w apps/server`.
   A file called `data.db` will appear. Add `data.db` to `.gitignore`.

**Read:** Drizzle docs → "Quick start (SQLite)" (https://orm.drizzle.team/docs/get-started-sqlite).

**Done when:** `data.db` exists and has the three tables (check with `npx drizzle-kit studio -w apps/server`).

---

## Task 2 · Save runs and events (about 1 day)

Every action in the orchestrator is already an event. Now you save them as they happen.

1. When a run starts (in the WebSocket handler or `runDebate`):
   - insert a row into `runs` with `status: "running"` and `startedAt: Date.now()`
   - on every `emit(event)`:
     - send to the WebSocket (as before)
     - insert into `events` with `runId`, `seq++`, `type: event.type`, `payload: JSON.stringify(event)`

   On `run_finished`, update the run's `status` and `finishedAt`.

2. **Decide about `llm_token`.** One debate creates hundreds of token events. Options:
   - save them all (simplest; replay shows text growing, but the database grows fast), or
   - stream them but don't save them (the `llm_response` and `agent_finished` events still have the full text).

   Make a choice and write 2 lines in `DIARY.md` about why. (There is no wrong answer, but the thesis needs the reason.)

3. Add two HTTP routes in `apps/server/src/index.ts`:
   - `GET /runs` — returns the list of all runs, newest first (`id`, `task`, `status`, `startedAt`, `finishedAt`)
   - `GET /runs/:id/events` — returns all saved events for that run, in order of `seq`

4. Test with `curl`:
   - run a debate from the browser
   - `curl localhost:3000/runs` → your debate is in the list
   - `curl localhost:3000/runs/<id>/events` → all the events are there

**Done when:** every run is saved to `data.db`, and you can fetch its events via HTTP.

---

## Task 3 · Past runs list and agent form (about 1 day)

Now connect the saved data to the web app.

### 3a. Past runs list

1. Add a "Past runs" panel to `apps/web` (below or next to the graph).
2. Fetch `GET /runs` on page load. Show a simple table: task, status (coloured badge), date, and a "View" button.
3. When the user clicks "View" on an old run:
   - fetch `GET /runs/:id/events`
   - reset the graph state
   - play the saved events through `applyEvent` one by one (or all at once) to re-create the
     same `events` state the live view uses. Because the graph is computed with `applyEvent`,
     **an old run shows its final graph with zero new code.**
4. Add a "Back to live" button to return to the active run.

5. **Server restart test:** run a debate, stop the server, start it again, open the run. It must still be there.

6. **A run that was running when the server stopped** will stay `running` forever. On server start,
   mark those runs as `stopped`. (Small thing, but a user study would trip on it.)

### 3b. Simple agent form

1. Routes: `GET /agents`, `POST /agents`, `DELETE /agents/:id`.
2. A form in the web app: **name**, **role** (a big text box for the system prompt), **model** (a dropdown;
   get the list from Ollama's `GET http://localhost:11434/api/tags` through the server).
3. Before starting a debate, the user picks which saved agents play Pro, Con and Judge.

Keep it simple. The full drag-and-drop team builder comes in December.

**Lesson from AutoGen Studio:** its form had no field for "this model can call tools", so you had to edit JSON.
If you ever add a setting the runtime needs, put it in the form.

**Done when:** you can create an agent in the browser and use it in a debate.

---

## Task 4 · Requirements chapter draft (about 1 day)

The first written chapter for the 40% checkpoint report. Use the structure below.
Write in plain, direct English (the same style as these docs). Aim for 3–5 pages.

### Structure

1. **User profile.** Who is this for?
   - Primary: computing students learning about LLM agents (need clarity, zero cost, visual intuition).
   - Secondary: developers debugging multi-agent workflows (need step-by-step inspection, replay, token costs).
   - Refer to your own experience in Week 3 with AutoGen Studio and CrewAI: what confused you is what your users will face.

2. **Functional requirements (FR).** What the system *must do*:
   - FR1: Agent configuration (name, role/system prompt, model, tools).
   - FR2: Team composition (sequential, manager-workers, group discussion).
   - FR3: Live visualization (nodes for agents, edges for messages, active-agent highlight).
   - FR4: Step inspection (exact prompt, reply, tokens, duration, tool call details).
   - FR5: Run persistence and replay (save all events, replay timeline, scrub through a run).
   - FR6: Local-model execution (run with Ollama without external API keys).

3. **Non-functional requirements (NFR).** How well it must do it:
   - NFR1: Event latency (the browser shows an event within 200 ms of the server emitting it).
   - NFR2: Zero cost to run (no paid APIs required).
   - NFR3: Reproducibility (a replayed run produces the exact same sequence of events as the live run).
   - NFR4: Usability (a first-time user can start a run within 5 minutes without reading a manual).

4. **MoSCoW prioritisation.**
   - Must have: FR1 (basic), FR3, FR4 (basic), FR5 (save + view), FR6, NFR1, NFR2.
   - Should have: FR2 (all three topologies), full replay scrubber, team builder UI.
   - Could have: run comparison, message editing / human-in-the-loop.
   - Won't have (this project): cloud deployment, multi-user accounts, training models.

**Done when:** the chapter has a full draft that covers all four sections.

---

## Task 5 · Architecture chapter draft (about 1 day)

The second written chapter. Explains *how* the system works and *why* it was built this way.
Aim for 4–6 pages, with at least two diagrams.

### Structure

1. **Overview diagram.** Boxes: Web app (React + React Flow) ↔ WebSocket/HTTP ↔ Server (Express) →
   Orchestrator → Ollama; Server → SQLite. Draw it in draw.io (free) or Excalidraw.
2. **The event model.** The central idea: every action is an event; live view, storage, replay and metrics
   all use the same list. Show the `AgentEvent` type and one real event sequence from a debate.
3. **The orchestrator.** It only talks to the outside through `emit`. Why this matters (you added saving
   without touching it).
4. **Client state.** `applyEvent` as a pure function; why it makes replay easy.
5. **Data model.** The three SQLite tables (`agents`, `runs`, `events`) and why `payload` is stored as JSON.
6. **Technology choices**, each with one reason:
   TypeScript everywhere (one language, shared types; you compared it with the Python frameworks),
   Express, WebSocket (`ws`) instead of polling, SQLite, React Flow, Ollama + Qwen 3 8B.
7. **A sequence diagram** of one debate: browser → server → orchestrator → Ollama → events back.

**Done when:** a classmate could understand how your system works from this chapter alone.

---

## Task 6 · Review and diary (about half a day)

1. Read through both chapter drafts. Fix any places where the text describes what you *plan* to do
   as if it were already done, or vice versa.
2. Check against the 40% checkpoint criteria (see `week-7.md`).
3. Fill in the Week 6 entry in `DIARY.md`.

---

## End of week checklist

- [ ] SQLite + Drizzle, three tables
- [ ] Every event saved; runs survive a restart
- [ ] Past runs list opens an old run as a graph
- [ ] Create-agent form, used by the debate
- [ ] Requirements chapter: full draft
- [ ] Architecture chapter: full draft with diagrams
- [ ] Diary entry: the `llm_token` decision and why
- [ ] Tick the tasks in the [roadmap tracker](https://claude.ai/artifact/SNVKp1dvsXVKaEBKAx5k5p)
