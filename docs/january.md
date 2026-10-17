# January · Inspect and replay

**Goal:** understand what happened in a run, step by step: open any step and see exactly what the model saw and said;
scrub back and forth through a finished run.

**Why:** this is where all three tools were weakest.
AutoGen Studio showed message text and tokens but not the prompt. CrewAI showed the prompt only after uploading to its cloud.
LangGraph Studio had time travel, but no prompts without LangSmith tracing, and its graph showed code, not conversation.
**Local, complete, visual inspection** is your platform's main contribution after the live graph.

| Week | Work |
| --- | --- |
| Jan 6–12 | Task 1: record full prompts · Task 2: step inspector |
| Jan 13–19 | Task 3: run history · Task 4: replay timeline |
| Jan 20–26 | Task 5: metrics per agent |
| Jan 27–31 | Task 6: start the Implementation chapter · ethics form (if needed) |

---

## Task 1 · Record exactly what the model saw (about 1 day)

To inspect a step you need the **full input** of every model call, not just the output.

Add an event:

```ts
| {
    type: "llm_request";
    agentId: string;
    callId: string; // links this request to its llm_response
    model: string;
    messages: Message[]; // the exact list sent to Ollama, system prompt included
    tools?: string[]; // names of the tools offered
  }
```

…and add the same `callId` and the reply text to `llm_response`.
Emit `llm_request` right before `chat()` in every orchestrator.

**Size check:** a long group chat sends the whole conversation every turn, so `messages` grows each call.
Look at the database size after 10 runs and write the number in the diary. If it's large, it's still fine for a laptop.

**Done when:** every model call in a run has an `llm_request` + `llm_response` pair in the database.

---

## Task 2 · Step inspector (about 2 days)

Click a node, an edge, or a log line → a side panel shows that step:

| Section | Content |
| --- | --- |
| Header | Agent name, pattern step ("turn 3 of 8"), status |
| Prompt | Every message sent, with role labels (system / user / assistant / tool), collapsible |
| Reply | The full reply |
| Tool calls | Tool name, arguments, result |
| Numbers | Prompt tokens, output tokens, time (ms) |

**Design tips:**

- Show the **system prompt** first and collapsed. It's the same every turn and gets in the way.
- Highlight what's **new** in this call compared with the agent's previous call (usually the last 1–2 messages).
  That's what a user wants to see when asking "why did it answer this?".
- CrewAI's trace viewer had "Details / Messages / Raw Data" tabs. A "Raw" tab with the JSON event is cheap and useful for debugging.

**Done when:** you can click any step of a finished run and see its full prompt, reply, tools and numbers.

---

## Task 3 · Run history (about 1 day)

Improve the "Past runs" list from Week 6 into a real page:

- columns: team, task, pattern, status + reason, start time, duration, total tokens
- filter by team and by status (show me the failed runs)
- delete a run (with a confirmation)

**Done when:** you can find last week's failed run in under 10 seconds.

---

## Task 4 · Replay timeline (about 2–3 days)

Because the UI is computed with `applyEvent` (Week 5), replay is mostly a slider:

```ts
const [position, setPosition] = useState(events.length);
const state = useMemo(
  () => events.slice(0, position).reduce(applyEvent, initialState),
  [events, position],
);
```

Build:

1. A **slider** under the graph from 0 to `events.length`. Moving it redraws the graph at that moment.
2. **Step buttons:** ◀ previous message, ▶ next message (jump between `message_sent` events, not single tokens).
3. **Play** button: replay the run at 1×, 2× or 5× speed, using the real time gaps between events.
4. **Markers** on the slider for important events: agent changes, tool calls, errors, the end reason.
5. The step inspector and the message log follow the slider position.

**Performance:** if replay is slow, skip `llm_token` events when scrubbing, or cache the state every 50 events.
Measure first, then optimise.

**Compared with LangGraph Studio:** it let you edit a step and fork the run (you tested it with the "purple dragon").
Replay is **read-only** for now. Edit-and-rerun is a February stretch option.

**Done when:** you can scrub through a finished run and the graph, log and inspector all follow.

---

## Task 5 · Tokens and time per agent (about 1–2 days)

A small "Run summary" panel with simple charts (Recharts: `npm install recharts -w apps/web`):

- tokens per agent (bar chart)
- time per agent (bar chart)
- tokens per turn over the run (line chart). Does the prompt grow each turn? (It does in group chat.)

These numbers are also part of your **technical evaluation** in March, so check they're correct:
compare one run's totals with Ollama's own numbers from the `llm_response` events.

**Done when:** the summary shows correct totals for one run you checked by hand.

---

## Task 6 · Start the Implementation chapter (about 2 days)

Don't wait until April. Write while the details are fresh. First draft, 5–8 pages:

1. Orchestrator: the three patterns, termination rules, how delegation works as a tool
2. Event pipeline: emit → save + stream; event types; the `llm_request` size decision
3. Client: reducer, live graph, layout, replay by slicing events
4. Interesting problems you solved (with diary references): e.g. the edge animation being too fast,
   the stop-word rule, skipped workers
5. Screenshots of the inspector and the replay slider

If December's ethics answer was "yes", fill in the ethics form this week.

---

## End of month checklist

- [ ] `llm_request` events with full prompts
- [ ] Step inspector: prompt, reply, tools, tokens, time
- [ ] Run history with filters
- [ ] Replay: slider, step buttons, play, markers
- [ ] Per-agent token and time charts, checked by hand
- [ ] Implementation chapter: first draft
- [ ] Ethics form submitted (if needed)
- [ ] Diary entries for each week
- [ ] Tick the tasks in the [roadmap tracker](https://claude.ai/artifact/SNVKp1dvsXVKaEBKAx5k5p)
