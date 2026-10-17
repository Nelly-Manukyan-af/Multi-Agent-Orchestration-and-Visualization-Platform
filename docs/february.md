# February · Stretch feature and study preparation

**Goal:** one extra feature, an easy setup, and **everything ready** for the user study in March.

**Why:** the study is the strongest evidence in your thesis. A well-prepared study with 10 people is worth more
than three more features. So this month, the study comes first and the stretch feature is second.

| Week | Work |
| --- | --- |
| Feb 1–7 | Task 1: study design · Task 2: planted-problem runs |
| Feb 8–14 | Task 3: study mode in the app · Task 4: templates |
| Feb 15–21 | Task 5: stretch feature · Task 6: one-command setup |
| Feb 22–28 | Task 7: pilot study · start recruiting (see March) |

---

## Task 1 · Design the study (about 2 days)

Write a one-page **study protocol** (it also goes into the Evaluation chapter and the ethics form).

**Research question:** does a live graph view help people understand multi-agent runs and find problems,
compared with a text log?

**Design: within-subjects.** Every participant uses **both** views:

- Half the participants start with the graph, half with the text log (**counterbalancing**),
  so "getting better at the task" doesn't favour one view.
- Each view gets **different** runs (but equally hard), so nobody sees the same problem twice.

**One session (about 30 minutes):**

| Time | Part |
| --- | --- |
| 3 min | Welcome, consent, a 2-minute intro to "what is an agent team" |
| 2 min | Practice run (not measured) |
| 10 min | View A: 3 runs, find the problem in each |
| 3 min | SUS questionnaire for view A |
| 10 min | View B: 3 different runs |
| 3 min | SUS for view B |
| 2 min | Two questions: "Which view did you prefer and why?" "What was confusing?" |

**What you measure per run:** correct answer (yes/no), time to answer (seconds), confidence (1–5).

**SUS (System Usability Scale):** 10 standard statements, answered 1–5, turned into a score from 0 to 100.
Use the standard wording exactly. Search "SUS questionnaire Brooke 1996" and cite it.

**Done when:** the protocol fits on one page and your supervisor has seen it.

---

## Task 2 · Runs with planted problems (about 2–3 days)

Participants look at **recorded** runs (replayed with your January replay feature), not live ones.
This makes every session identical and doesn't depend on the slow model.

Create 6–8 runs, each with **one clear problem** that a person could find. Base them on what you really saw:

| Problem | How to create it | Seen in |
| --- | --- | --- |
| An agent is never used | Manager does all the work itself | CrewAI hierarchical test |
| An agent forgets its role | Critic starts writing raps | AutoGen tests |
| A loop | Two agents repeat the same exchange until max turns | Week 3 debate |
| A false fact passed along | Researcher invents a fact, Writer uses it | LangGraph "purple dragon" test |
| Stopped by the stop word too early | The stop word appears in a normal message | AutoGen "FINISH" test |
| An agent ignores instructions | "Never rate yourself" → rates itself | AutoGen rapper test |

You can create them by running real teams until the problem happens, or by **editing prompts** so it happens on purpose.
Save the run ids in a list in `docs/study/runs.md` with the correct answer for each.

**Balance:** split the runs into two sets of equal difficulty (set A, set B). Test this in the pilot (Task 7).

**Done when:** 6–8 runs are saved, each with a written correct answer.

---

## Task 3 · Study mode in the app (about 2 days)

A special screen for participants, so nothing distracts them:

- `?study=1&view=graph` or `view=log`: shows only one view (graph with inspector, or text log)
- loads the runs of one set, one after another
- a text box: "What went wrong in this run?" + confidence 1–5 + "Next"
- records the time from opening a run to pressing "Next"
- saves the answers in a `study_answers` table (participant code like `P07`, never a name)
- a simple export: `GET /study/export.csv`

**Done when:** you can do a full fake session yourself and get a CSV.

---

## Task 4 · Templates (about 1 day)

Two ready-made teams, so new users (and your demo) start fast:

- **Debate:** Pro, Con, Judge (group chat)
- **Research and Report:** Researcher → Writer → Editor (sequential)

A "New team from template" button in the team builder. Store the templates as JSON files in the repo.

---

## Task 5 · Stretch feature: choose ONE (about 3–4 days)

| Option | What | Inspired by | Effort |
| --- | --- | --- | --- |
| **A. Pause and edit** | Pause a run, edit the last message or an agent's state, continue from there | LangGraph Studio's edit + fork | Higher: the orchestrator must stop and resume |
| **B. Compare two runs** | Two runs side by side, graph + summary, differences highlighted | AutoGen Studio's Compare (which only put them side by side) | Lower: uses saved events only |

**Tip:** B is safer for the time you have, and it's useful in the thesis (compare the same team on two models,
or before/after a prompt change). Choose A only if January finished early.

Write in the diary which one you chose and why.

---

## Task 6 · One-command setup (about 1 day)

Goal: someone clones the repo and starts the platform with one command. Useful for your examiners.

**Recommendation:** Docker Compose for **your app** (server + web), but run **Ollama natively** on the Mac.
Ollama inside Docker on a Mac can't use the Apple GPU, so the model would be much slower.

```yaml
# docker-compose.yml (sketch)
services:
  server:
    build: ./apps/server
    environment:
      OLLAMA_URL: http://host.docker.internal:11434 # Ollama running on the Mac itself
    volumes: ["./data:/app/data"] # keep the SQLite file outside the container
    ports: ["3000:3000"]
  web:
    build: ./apps/web
    ports: ["5173:80"]
```

Write the README section: install Ollama → `ollama pull qwen3:8b` → `docker compose up` → open the browser.
**Test it on a clean folder** (clone the repo into `/tmp` and follow your own README).

**Done when:** a fresh clone starts with the README steps only.

---

## Task 7 · Pilot study (about 1 day)

Run the full session with **1–2 people** (friends are fine). They are not part of the results.

Check:

- Does the session fit in 30 minutes?
- Are the planted problems findable? Too easy? Too hard?
- Are set A and set B equally hard?
- Is any instruction confusing?
- Does the CSV export contain everything?

Fix what's broken. Write the changes in the diary. The Evaluation chapter will mention the pilot.

---

## End of month checklist

- [ ] Study protocol (1 page), seen by the supervisor
- [ ] 6–8 planted-problem runs with correct answers, in two balanced sets
- [ ] Study mode + CSV export
- [ ] Two templates
- [ ] One stretch feature
- [ ] One-command setup, tested on a fresh clone
- [ ] Pilot with 1–2 people, fixes done
- [ ] Ethics approval received (if it was needed)
- [ ] Diary entries for each week
- [ ] Tick the tasks in the [roadmap tracker](https://claude.ai/artifact/SNVKp1dvsXVKaEBKAx5k5p)
