# December · Team builder and interaction patterns

**Goal:** users build their own teams in the browser, and the orchestrator supports three ways of working together.

**Why:** until now the platform runs one fixed debate. The tools you tested each support some patterns:
AutoGen has group chat, CrewAI has sequential and manager/worker ("hierarchical"), LangGraph lets you wire any graph in code.
Your platform needs a few patterns **and** shows each of them clearly, including the failures you saw
(the CrewAI manager that skipped the Writer, the AutoGen stop word in the user's message).

**Plan for holidays:** this plan has 3 working weeks. If you work less over the holidays, drop Task 5 (tools), not Tasks 1–4.

| Week | Work |
| --- | --- |
| Dec 2–8 | Task 1: team model · Task 6: ethics question (one email) |
| Dec 9–15 | Task 2: sequential · Task 3: manager and workers |
| Dec 16–22 | Task 4: group discussion · Task 5: team builder UI |
| Dec 23 – Jan 5 | Holidays / buffer · Task 7: tools per agent (optional) |

---

## Task 1 · A general team model (about 2 days)

The debate is a special case. Describe **any** team as data:

```ts
// packages/shared/src/team.ts
export type Pattern = "sequential" | "manager" | "group_chat";

export type Team = {
  id: string;
  name: string;
  pattern: Pattern;
  agentIds: string[]; // the order matters for "sequential" and round-robin "group_chat"
  managerId?: string; // only for "manager"
  maxTurns: number; // a hard limit, always (a run must never loop forever)
  stopWord?: string; // e.g. "FINISH" (optional)
};
```

Then one entry point that picks the right orchestrator:

```ts
export async function runTeam(runId: string, team: Team, task: string, emit: Emit) {
  switch (team.pattern) {
    case "sequential": return runSequential(...);
    case "manager": return runManager(...);
    case "group_chat": return runGroupChat(...);
  }
}
```

**Termination rules (lessons from AutoGen):**

- The stop word is checked **only in agent messages**, never in the user's task.
  (In AutoGen, "FINISH" in your own task ended the run before any agent spoke.)
- When a run ends, emit **why**: add `reason: "stop_word" | "max_turns" | "error" | "user_stopped" | "done"`
  to `run_finished`. Show the reason in the UI. AutoGen only showed a short text line, and CrewAI showed nothing.

Add a `teams` table (like `agents`, with `agentIds` as JSON).

**Done when:** the debate runs as a `group_chat` team through `runTeam`, and `run_finished` has a reason.

---

## Task 2 · Pattern 1: sequential pipeline (about 1 day)

```
task → A → B → C → result
```

Each agent gets the task plus the previous agent's output. This is CrewAI's default.

- Emit `message_sent` from A to B with A's output, so the graph shows the hand-over as an edge.
- Test team: **Researcher → Writer → Editor** (same idea as your CrewAI crew).

**Done when:** a 3-agent pipeline runs and the graph shows A → B → C lighting up in order.

---

## Task 3 · Pattern 2: manager and workers (about 2 days)

One agent (the manager) splits the task and hands parts to workers. This is CrewAI's "hierarchical" mode.

**How:** give the manager a **tool**, like CrewAI's "Delegate work to coworker":

```ts
const delegateTool: ToolDefinition = {
  type: "function",
  function: {
    name: "delegate",
    description: "Give a piece of work to one of your workers and get their answer back.",
    parameters: {
      type: "object",
      properties: {
        worker: { type: "string", description: "The worker's name", enum: workerNames },
        task: { type: "string", description: "What the worker should do, with all needed context" },
      },
      required: ["worker", "task"],
    },
  },
};
```

You built a tool loop in week 2 (`02-agent-with-tools.ts`). When the manager calls `delegate`,
run that worker and return its answer as the tool result.

**Events:** `tool_called` (manager → delegate), then `message_sent` manager → worker,
the worker's own `agent_started` … `agent_finished`, then `message_sent` worker → manager.

**The important part for your thesis:** in your CrewAI test the manager sometimes did all the work itself,
and nothing warned you. In your platform:

- show workers that **never ran** as greyed out at the end, with a small "not used" label
- if the manager finishes without calling `delegate` even once, add a visible warning on the run

**Done when:** a manager + 2 workers team runs, delegation shows as edges, and a skipped worker is visible.

---

## Task 4 · Pattern 3: group discussion (about 2 days)

Agents take turns in one shared conversation. This is AutoGen's group chat, and your debate generalised.

1. **Round-robin first:** agents speak in the order of `agentIds` until `maxTurns` or the stop word.
2. **Then (optional) model-chosen speaker:** a small extra model call with
   "Here is the conversation. Who should speak next? Answer with one name from: …".
   Emit a `speaker_selected` event with the reason, so the graph can show *why* someone speaks.

Each agent sees the conversation like in the debate: its own turns as `assistant`, everyone else's as `user`,
with a name prefix such as `Critic: …`.

**Done when:** a 3-agent discussion runs in round-robin and stops by stop word or by max turns, with the reason shown.

---

## Task 5 · The team builder UI (about 3 days)

Build the team in the browser with React Flow, like AutoGen Studio's Team Builder, but simpler and clearer.

1. **Left sidebar:** your saved agents. Drag one onto the canvas to add it to the team.
2. **Top bar:** pattern dropdown (sequential / manager / group chat), max turns, stop word, team name, Save.
3. **Canvas:**
   - sequential: the user connects agents with edges to set the order
   - manager: one node is marked as manager (a crown icon or a different colour)
   - group chat: all agents around a circle, no edges needed
4. **Validation before Save**, shown next to the problem (not a hidden error count like AutoGen's "1 errors"):
   "Sequential needs a path from the first to the last agent", "Manager pattern needs exactly one manager", …
5. **Automatic layout** for the live view of any team: use `dagre` (`npm install @dagrejs/dagre -w apps/web`)
   for sequential and manager, a circle for group chat.

**Done when:** you build a team in the browser, save it, run it, and the live graph uses the same layout.

---

## Task 6 · Ethics approval (one email, do it in the first week!)

The user study in March involves people. Many universities need an ethics form even for a small,
anonymous usability study, and approval can take weeks.

- Email your supervisor: "My March user study: 8–12 students, ~30 minutes, they use my tool to find problems
  in recorded agent runs and fill in the SUS questionnaire. Anonymous, no personal data. Do I need ethics approval?"
- Write the answer in the diary. If yes, the form becomes a January task.

---

## Task 7 · Tools per agent (optional, if time)

Let an agent use tools from a fixed list (your `days_between`, `save_note`, a calculator).
Show tool calls in the graph as a small badge on the node (🔧 2), and the arguments and result on hover.
AutoGen Studio's tool-call display ("Calling calculator tool with arguments …", "Tool Result 90.0") was clear. Do something similar.

---

## End of month checklist

- [ ] `Team` type, `teams` table, `runTeam()` with three patterns
- [ ] `run_finished` always has a reason, shown in the UI
- [ ] Manager pattern: delegation edges, skipped workers visible
- [ ] Team builder: drag agents, pick pattern, validate, save, run
- [ ] Ethics email sent, answer in the diary
- [ ] Diary entries for each week
- [ ] Tick the tasks in the [roadmap tracker](https://claude.ai/artifact/SNVKp1dvsXVKaEBKAx5k5p)
