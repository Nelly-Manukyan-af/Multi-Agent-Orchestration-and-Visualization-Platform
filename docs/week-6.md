# Week 6 · Nov 16–22 · Storage and writing

**Goal:** runs survive a server restart, users can create their own agents, and two thesis chapters have a full draft.

**Why:** AutoGen Studio kept runs after a reload, CrewAI lost everything when the terminal scrolled,
and CrewAI's only way to look back was uploading to its cloud. Saving every event **locally** is what makes
your inspector and replay (January) possible, and it keeps the platform free and offline.

**Order:** database → save events → read old runs → agent form → writing.
This week is half code, half writing. **Don't skip the writing**: the checkpoint is in 9 days.

| Day | Work |
| --- | --- |
| Mon | Task 1: SQLite + Drizzle setup |
| Tue | Task 2: save and load runs |
| Wed | Task 3: create-agent form |
| Thu | Task 4: Requirements chapter |
| Fri–Sat | Task 5: Architecture chapter |

---

## Task 1 · SQLite + Drizzle setup (about 1 day)

**SQLite** is a whole database in one file. No server to install.
**Drizzle** lets you describe tables in TypeScript and query them with types.

1. Install (from the project root):

   ```sh
   npm install drizzle-orm better-sqlite3 -w apps/server
   npm install -D drizzle-kit @types/better-sqlite3 -w apps/server
   ```

2. Describe the tables in `apps/server/src/db/schema.ts`:

   ```ts
   import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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
     seq: integer("seq").notNull(), // 0, 1, 2… the order inside the run
     type: text("type").notNull(),
     timestamp: integer("timestamp").notNull(),
     payload: text("payload", { mode: "json" }).notNull(), // the whole event as JSON
   });

   export const agents = sqliteTable("agents", {
     id: text("id").primaryKey(),
     name: text("name").notNull(),
     role: text("role").notNull(), // the system prompt
     model: text("model").notNull(),
   });
   ```

   **Why store the whole event as JSON?** Your event types will keep growing (December, January).
   With a `payload` column you never need to change the table when you add an event type.
   The `seq` column guarantees the order, even if two events have the same millisecond.

3. Create `apps/server/drizzle.config.ts` and run `npx drizzle-kit push` to create the tables.
   Follow Drizzle's "Get started with SQLite" guide for the exact config: https://orm.drizzle.team/docs/get-started

4. The `.gitignore` already ignores `*.db`, so the database file is never committed.

**Done when:** the `.db` file exists and has the three tables (check with `sqlite3 data.db ".tables"`).

---

## Task 2 · Save and load runs (about 1 day)

1. **Save.** When a run starts, insert a row in `runs`. Then give the orchestrator an `emit` that does two things:

   ```ts
   let seq = 0;
   const emit = (event: AgentEvent) => {
     db.insert(events) // 1. save
       .values({ id: event.id, runId: event.runId, seq: seq++, type: event.type, timestamp: event.timestamp, payload: event })
       .run();
     if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event)); // 2. stream
   };
   ```

   The orchestrator does not change at all. This is the payoff of the `emit` design from Week 4.

   On `run_finished`, update the run's `status` and `finishedAt`.

2. **Decide about `llm_token`.** One debate creates hundreds of token events. Options:
   - save them all (simplest; replay shows text growing, but the database grows fast), or
   - stream them but don't save them (the `llm_response` and `agent_finished` events still have the full text).

   Pick one, and **write the reason in the diary**. This is a real design decision for the Architecture chapter.

3. **Load.** Add two routes:
   - `GET /runs` → list of runs, newest first
   - `GET /runs/:id/events` → all events of one run, ordered by `seq`

4. **In the web app**, add a "Past runs" list. Clicking a run fetches its events and puts them into the
   same `events` state the live view uses. Because the graph is computed with `applyEvent`,
   **an old run shows its final graph with zero new code.**

5. **Server restart test:** run a debate, stop the server, start it again, open the run. It must still be there.

6. **A run that was running when the server stopped** will stay `running` forever. On server start,
   mark those runs as `stopped`. (Small thing, but a user study would trip on it.)

**Done when:** a run is still there after restarting the server, and it shows its final graph.

---

## Task 3 · Create-agent form (about 1 day)

Until now, Pro, Con and Judge were hard-coded. Let users make their own.

1. Routes: `GET /agents`, `POST /agents`, `DELETE /agents/:id`.
2. A form in the web app: **name**, **role** (a big text box for the system prompt), **model** (a dropdown;
   get the list from Ollama's `GET http://localhost:11434/api/tags` through the server).
3. Before starting a debate, the user picks which saved agents play Pro, Con and Judge.

Keep it simple. The full drag-and-drop team builder comes in December.

**Lesson from AutoGen Studio:** its form had no field for "this model can call tools", so you had to edit JSON.
If you ever add a setting the runtime needs, put it in the form.

**Done when:** you can create an agent in the browser and use it in a debate.

---

## Task 4 · Requirements chapter (about 1 day)

**What it answers:** what must the platform do, and for whom? Aim for 3–5 pages.

Suggested structure:

1. **Users.** Who uses it? For example: a developer building a multi-agent system who needs to understand
   why a run went wrong; a student learning how agents work together.
2. **Problems** (from your tool tests, with evidence from the diary):
   - you can't see who talked to whom (CrewAI hierarchical: the Writer never ran, and nothing warned you)
   - stop rules behave in surprising ways (AutoGen: "FINISH" in the user's own message ended the run)
   - you can't see the exact prompt without a cloud service (CrewAI tracing)
3. **Functional requirements** with **MoSCoW priority** (Must / Should / Could / Won't):

   | ID | Requirement | Priority |
   | --- | --- | --- |
   | F1 | Show a running team as a graph that updates live | Must |
   | F2 | Show which agent is active and which message is being sent | Must |
   | F3 | Save every run and its events | Must |
   | F4 | Inspect one step: exact prompt, reply, tokens, time | Must |
   | F5 | Replay a finished run step by step | Should |
   | F6 | Build a team visually | Should |
   | … | … | … |

4. **Non-functional requirements:** runs on a laptop with 16 GB RAM; free (local models only);
   event delay under N ms (you measured it in Week 4); open source.
5. **Out of scope** (the "Won't" list): cloud deployment, user accounts, paid models, training models.

**Done when:** every "Must" requirement can be traced back to a problem you saw.

---

## Task 5 · Architecture chapter (about 1.5 days)

**What it answers:** how is the platform built, and why this way? Aim for 4–6 pages plus diagrams.

Suggested structure:

1. **Overview diagram.** Boxes: Web app (React + React Flow) ↔ WebSocket/HTTP ↔ Server (Fastify) →
   Orchestrator → Ollama; Server → SQLite. Draw it in draw.io (free) or Excalidraw.
2. **The event model.** The central idea: every action is an event; live view, storage, replay and metrics
   all use the same list. Show the `AgentEvent` type and one real event sequence from a debate.
3. **The orchestrator.** It only talks to the outside through `emit`. Why this matters (you added saving
   without touching it).
4. **Client state.** `applyEvent` as a pure function; why it makes replay easy.
5. **Storage.** Tables, the JSON payload choice, the `llm_token` decision from Task 2.
6. **Technology choices**, each with one reason:
   TypeScript everywhere (one language, shared types; you compared it with the Python frameworks),
   Fastify, WebSocket instead of polling, SQLite, React Flow, Ollama + Qwen 3 8B.
7. **A sequence diagram** of one debate: browser → server → orchestrator → Ollama → events back.

**Done when:** a classmate could understand how your system works from this chapter alone.

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
