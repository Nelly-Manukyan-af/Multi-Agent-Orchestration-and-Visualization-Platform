# Week 4 · Nov 2–8 · Server and live events

**Goal:** move the debate from a terminal script into a server, and send every agent action to the browser as an event.

**Why:** all three tools you tested only show a run *after the fact* or as a text log. Your platform is built on
one idea: **every action is an event**, and the live graph, the replay and the metrics are all made from that list.
This week you build the event stream. Next week you draw it.

**Order:** Express basics → shared event types → orchestrator → WebSocket (`ws`) → test page.

| Day | Work |
| --- | --- |
| Mon | Task 1: Express basics |
| Tue | Task 2: shared event types |
| Wed–Thu | Task 3: the orchestrator |
| Fri | Task 4: WebSocket (`ws`) |
| Sat | Task 5: test page + diary |

**Before you start:** `npm run debate` from Week 3 must work. This week reuses it.

---

## Task 1 · Express basics (about half a day)

Express is a widely-used, mature web server library for Node.js. You will use it for the HTTP API and static file serving.

1. Create `apps/server/package.json`:

   ```json
   {
     "name": "@agent-platform/server",
     "private": true,
     "type": "module",
     "scripts": {
       "dev": "node --watch src/index.ts"
     }
   }
   ```

2. Install from the **project root** (the `-w` flag installs into one workspace):

   ```sh
   npm install express ws cors -w apps/server
   npm install -D @types/express @types/ws @types/cors -w apps/server
   ```

3. Create `apps/server/src/index.ts` with one route:

   ```ts
   import express from "express";

   const app = express();
   app.use(express.json());

   app.get("/health", (_req, res) => {
     res.json({ ok: true });
   });

   app.listen(3000, () => {
     console.log("Server listening on http://localhost:3000");
   });
   ```

4. Run it: `npm run dev -w apps/server`, then open http://localhost:3000/health.
   `--watch` restarts the server every time you save a file.

5. Add a `POST /echo` route that returns the JSON body it receives:

   ```ts
   app.post("/echo", (req, res) => {
     res.json(req.body);
   });
   ```

   Test it with:

   ```sh
   curl -X POST localhost:3000/echo -H 'Content-Type: application/json' -d '{"hello":"world"}'
   ```

**Read:** Express docs → "Getting Started" and "Routing" (https://expressjs.com/).

**Done when:** `/health` and `/echo` work.

---

## Task 2 · Shared event types (about half a day)

The server **sends** events and the web app **reads** them, so both must agree on their shape.
That is what `packages/shared` is for: one TypeScript file, used by both sides.

1. Create `packages/shared/package.json`:

   ```json
   {
     "name": "@agent-platform/shared",
     "private": true,
     "type": "module",
     "exports": { ".": "./src/events.ts" }
   }
   ```

2. Run `npm install` in the project root. npm links the workspace, so the server can now write
   `import type { AgentEvent } from "@agent-platform/shared";`

3. Open `packages/shared/src/events.ts` (already sketched) and add one event for streaming:

   ```ts
   | { type: "llm_token"; agentId: string; text: string } // one small piece of a reply, as it arrives
   ```

4. Read every event type and ask: "Could I draw this in a graph?" For example:
   - `agent_started` → light up the node
   - `message_sent` → animate the edge from `fromAgentId` to `toAgentId`
   - `llm_token` → show the reply growing inside the node
   - `run_finished` with `status: "failed"` → show an error (remember LangGraph's red "Error" label)

5. Add a helper that fills in `id` and `timestamp`, so you never forget them:

   ```ts
   // in apps/server/src/events.ts
   import type { AgentEvent } from "@agent-platform/shared";

   // A type helper: "an AgentEvent without id, runId and timestamp"
   type NewEvent = DistributiveOmit<AgentEvent, "id" | "runId" | "timestamp">;
   type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;

   export function makeEvent(runId: string, event: NewEvent): AgentEvent {
     return { ...event, id: crypto.randomUUID(), runId, timestamp: Date.now() } as AgentEvent;
   }
   ```

   `DistributiveOmit` is needed because `AgentEvent` is a union. A plain `Omit` would merge all the variants.
   Don't worry if this looks strange. It is a common TypeScript pattern; you only write it once.

**Done when:** the server imports `AgentEvent` from `@agent-platform/shared` and `npm run typecheck` passes.

---

## Task 3 · The orchestrator (about 1.5 days)

The **orchestrator** is the code that decides which agent runs next and what it sees.
In Week 3 your debate loop *was* an orchestrator, but it printed text. Now it **emits events** instead.

### Structure

```
apps/server/src/
├── index.ts            ← Express server + WebSocket setup
├── events.ts           ← makeEvent()
├── llm/ollama.ts       ← copy of learning/ollama.ts
└── orchestrator/
    └── debate.ts       ← runDebate()
```

### Steps

1. Copy `learning/ollama.ts` to `apps/server/src/llm/ollama.ts`. Keep `learning/` untouched as your learning history.

2. Move the debate from `learning/03-debate.ts` into `orchestrator/debate.ts` with this signature:

   ```ts
   export async function runDebate(
     runId: string,
     topic: string,
     emit: (event: AgentEvent) => void, // the orchestrator does not know WHERE events go
   ): Promise<void>
   ```

   The `emit` parameter is the key design idea: the orchestrator only *announces* what happens.
   Today `emit` sends to a WebSocket. In Week 6 it also saves to the database. The orchestrator never changes.

3. Replace every `console.log("[event] …")` with an `emit(...)`:

   | When | Event |
   | --- | --- |
   | start | `run_started` with the agent ids |
   | an agent begins | `agent_started` |
   | each token from `onToken` | `llm_token` |
   | the model call ends | `llm_response` with tokens and `durationMs` from `ChatResult` |
   | Pro replies to Con | `message_sent` from `pro` to `con` |
   | an agent is done | `agent_finished` |
   | end | `run_finished` with `status: "completed"` |

4. Wrap the whole run in `try/catch`. On an error, emit `run_finished` with `status: "failed"`.
   **Lesson from AutoGen and CrewAI:** a failed or strange run must never look like a normal "Task completed".

5. Test without a browser: write a tiny script that calls `runDebate` with `emit: (e) => console.log(e.type, e)`.

**Done when:** one debate produces a clean list of events in the terminal, in the right order.

---

## Task 4 · WebSocket with `ws` (about 1 day)

HTTP is "the browser asks, the server answers". A **WebSocket** is an open line in both directions,
so the server can push each event the moment it happens.

1. Attach the `ws` server to the Node HTTP server in `index.ts`:

   ```ts
   import express from "express";
   import { createServer } from "node:http";
   import { WebSocketServer, WebSocket } from "ws";
   import { runDebate } from "./orchestrator/debate.js";

   const app = express();
   app.use(express.json());

   const server = createServer(app);
   const wss = new WebSocketServer({ server, path: "/ws" });

   wss.on("connection", (socket) => {
     socket.on("message", async (raw) => {
       const msg = JSON.parse(raw.toString());
       if (msg.type === "start_run") {
         const runId = crypto.randomUUID();
         await runDebate(runId, msg.topic, (event) => {
           if (socket.readyState === WebSocket.OPEN) {
             socket.send(JSON.stringify(event));
           }
         });
       }
     });
   });

   server.listen(3000, () => {
     console.log("Server listening on http://localhost:3000");
   });
   ```

2. Messages in the other direction (browser → server) also need a type. Add to `packages/shared`:

   ```ts
   export type ClientMessage = { type: "start_run"; topic: string };
   ```

   Later you will add `stop_run`, `pause_run`, and so on.

3. Always check `socket.readyState === WebSocket.OPEN` before sending so that disconnected clients don't crash the server.

**Done when:** you can connect with a test page (Task 5) and receive events.

---

## Task 5 · A plain HTML test page (about half a day)

Not React yet. A plain page is enough to prove the events arrive live.

1. Serve static files from `apps/server/public` with Express:

   ```ts
   import path from "node:path";
   import { fileURLToPath } from "node:url";

   const __dirname = path.dirname(fileURLToPath(import.meta.url));
   app.use(express.static(path.join(__dirname, "../public")));
   ```

2. The page has: a text box for the topic, a "Start" button, and a list.
   On "Start", open `new WebSocket("ws://localhost:3000/ws")`, send `{ type: "start_run", topic }`,
   and add one line to the list for every event (except `llm_token`).

3. Show `llm_token` differently: append the text to a "live reply" box, so you see the words arrive.

4. Open http://localhost:3000 and run a debate.

### Things to try (note the results in the diary)

- Open two tabs and start two debates at once. Do they mix up? (They shouldn't: each socket gets its own events.)
- How long is the gap between the server creating an event and the browser showing it?
  Compare `event.timestamp` with `Date.now()` in the browser. This is one of your **technical metrics** in March.
- Stop Ollama in the middle of a run (`brew services stop ollama` or quit the app). Do you get `run_finished: failed`?
- How many `llm_token` events does one debate send? (Hundreds is normal.)

**Done when:** you start a debate from the browser and see the events arrive live.

---

## End of week checklist

- [ ] `apps/server` runs with `npm run dev -w apps/server`
- [ ] Events are typed in `packages/shared` and used by the server
- [ ] `runDebate()` only talks to the outside world through `emit`
- [ ] Debate runs from the browser test page, events arrive live
- [ ] A failed run shows `run_finished` with `status: "failed"`
- [ ] Diary entry: what you built, what broke, the event delay you measured
- [ ] Tick the tasks in the [roadmap tracker](https://claude.ai/artifact/SNVKp1dvsXVKaEBKAx5k5p)

**For the thesis (write 3–4 sentences in the diary now, you will need them in Week 6):**
why events instead of just saving the final text? (Answer: live view, replay and metrics all come from one list,
and the orchestrator does not need to know about the UI.)
