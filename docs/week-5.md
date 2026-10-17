# Week 5 · Nov 9–15 · The live graph

**Goal:** the core idea of the thesis: watch the agents as a graph while they work.

**Why:** in your tool tests, AutoGen Studio had a small graph that only adds a box per message,
LangGraph Studio showed the *code structure* (nodes and edges you wrote), and CrewAI had no graph at all.
None of them showed **the conversation itself: who is talking to whom, right now.** That is what you build this week.

**Order:** React app → React Flow tutorial → events to state → graph → message log.

| Day | Work |
| --- | --- |
| Mon | Task 1: create the web app |
| Tue | Task 2: React Flow tutorial |
| Wed | Task 3: events → state (the reducer) |
| Thu–Fri | Task 4: the live graph |
| Sat | Task 5: message log + diary |

**Before you start:** the Week 4 server must stream a debate over `ws://localhost:3000/ws`.

---

## Task 1 · Create the web app (about half a day)

1. From `apps/web`:

   ```sh
   npm create vite@latest . -- --template react-ts
   ```

   Answer "yes" if it asks about the existing README. Then, from the project root:

   ```sh
   npm install
   npm install @xyflow/react -w apps/web
   ```

   `@xyflow/react` is the current package name of React Flow.

2. Add the shared types to the web app's `package.json` dependencies:
   `"@agent-platform/shared": "*"`, then `npm install` again.

3. Make Vite forward the WebSocket to the server, so the browser only talks to one address.
   In `apps/web/vite.config.ts`:

   ```ts
   server: {
     proxy: { "/ws": { target: "ws://localhost:3000", ws: true } },
   },
   ```

4. Run both: `npm run dev -w apps/server` in one terminal, `npm run dev -w apps/web` in another.
   Open the address Vite prints (usually http://localhost:5173).

**Done when:** the Vite starter page loads and `import type { AgentEvent } from "@agent-platform/shared"` compiles.

---

## Task 2 · React Flow tutorial (about 1 day)

Do the official "Learn" section: https://reactflow.dev/learn

Focus on:

- **Nodes and edges**: plain arrays of objects with `id`, `position`, `data` / `source`, `target`.
- **Custom nodes**: your own React component for a node. You need this for agent nodes.
- **Animated edges**: `animated: true` on an edge makes it move. You need this for messages.
- **Controlled flow**: you own the `nodes` and `edges` arrays in React state; React Flow just draws them.

Skip for now: sub-flows, the "Pro" examples, layouting libraries.

**Done when:** you can draw 3 custom nodes and 2 edges and make one edge animate with a button.

---

## Task 3 · Events → state: the reducer (about 1 day)

This is the most important design decision of the week, so take your time.

**The rule:** the UI never keeps its own story of what happened. It only keeps the **list of events**,
and computes everything it shows from that list with one pure function.

```ts
// apps/web/src/runState.ts
import type { AgentEvent } from "@agent-platform/shared";

export type AgentStatus = "idle" | "thinking" | "done" | "error";

export type RunState = {
  status: "idle" | "running" | "completed" | "failed" | "stopped";
  agents: Record<string, { status: AgentStatus; liveText: string; tokens: number }>;
  messages: { from: string; to: string; content: string; timestamp: number }[];
  activeEdge: { from: string; to: string } | null; // the message being sent right now
};

export function applyEvent(state: RunState, event: AgentEvent): RunState {
  switch (event.type) {
    case "run_started": /* set status "running", create every agent as "idle" */
    case "agent_started": /* that agent → "thinking", clear its liveText */
    case "llm_token": /* append event.text to that agent's liveText */
    case "llm_response": /* add the tokens */
    case "message_sent": /* push to messages, set activeEdge */
    case "agent_finished": /* that agent → "done" */
    case "run_finished": /* set the run status */
  }
  return state;
}
```

Fill in each case. Return a **new** object (don't change `state` in place). React needs that to notice changes.

**Why this matters:** in January, replay becomes almost free.
`events.slice(0, n).reduce(applyEvent, initialState)` shows the run at step `n`.
You are building replay now without noticing.

Then write a hook that connects the WebSocket to the reducer:

```ts
// apps/web/src/useRun.ts
export function useRun() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const state = useMemo(() => events.reduce(applyEvent, initialState), [events]);

  function start(topic: string) {
    setEvents([]);
    const ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ type: "start_run", topic }));
    ws.onmessage = (msg) => setEvents((old) => [...old, JSON.parse(msg.data)]);
  }

  return { events, state, start };
}
```

**Test it before drawing anything:** render `JSON.stringify(state, null, 2)` in a `<pre>` and watch it change during a debate.

**Done when:** the raw state updates live and ends with every agent `"done"` and the run `"completed"`.

---

## Task 4 · The live graph (about 1.5 days)

1. **Agent node.** Make a custom node component that shows:
   - the agent's name (Pro, Con, Judge)
   - a status colour: grey = idle, blue + pulsing border = thinking, green = done, red = error
   - the last ~100 characters of `liveText` while thinking, so you see it "talk"

2. **Positions.** Three agents don't need an automatic layout. Put Pro left, Con right, Judge below:

   ```ts
   const positions = { pro: { x: 0, y: 0 }, con: { x: 400, y: 0 }, judge: { x: 200, y: 250 } };
   ```

   (Automatic layout for any team comes in December.)

3. **Edges from messages.** Make one edge per pair that has talked (`pro→con`, `con→pro`, `pro→judge`, …).
   The edge that matches `activeEdge` gets `animated: true` and a thicker stroke. Others stay thin and grey.
   Show the number of messages on the edge as a label, e.g. `3`.

4. **Make it readable.** A fast run is hard to follow. Keep `activeEdge` animated for ~1.5 s after a message,
   even if the next event arrives sooner (a `setTimeout` in the component, not in the reducer).

5. A topic box and a "Start" button above the graph.

**Done when:** a debate plays out live: nodes light up in turn, the edge animates on each message, the Judge goes green at the end.

---

## Task 5 · The message log (about half a day)

Next to the graph, show the same run as plain text:

```
Pro → Con   "Remote work saves 2 hours of travel a day…"     312 tokens · 4.1 s
Con → Pro   "But teams lose spontaneous conversations…"      288 tokens · 3.8 s
```

**This log is important for your evaluation:** in March, participants will look for problems
with the **graph view** and with **this text view**, and you compare them. So keep it a fair, readable log,
not a deliberately bad one.

Clicking a line in the log should highlight the matching edge in the graph (and the other way round, if you have time).
LangGraph Studio did this with hover, and it made the two views feel like one.

### Things to try (note the results in the diary)

- Run 3 rounds instead of 2. Does the graph still make sense, or do the edge labels get messy?
- Turn the browser window small (laptop half-screen). Is it still usable?
- Ask a friend to watch one run for 1 minute and tell you what happened, without explaining anything first.
  What did they understand from the graph? This is a tiny preview of your user study.

---

## End of week checklist

- [ ] `apps/web` runs with Vite and uses the shared types
- [ ] All UI state comes from `events.reduce(applyEvent, …)`
- [ ] Live graph: status colours, live text, animated edges, message counts
- [ ] Message log next to the graph
- [ ] **Take screenshots and a short screen recording now.** You need them for the checkpoint report.
- [ ] Diary entry: what worked, what was hard, what the friend said
- [ ] Tick the tasks in the [roadmap tracker](https://claude.ai/artifact/SNVKp1dvsXVKaEBKAx5k5p)
