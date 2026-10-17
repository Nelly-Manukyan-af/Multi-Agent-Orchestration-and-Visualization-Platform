# Week 7 · Nov 23 – Dec 1 · 40% checkpoint (deadline)

**Goal:** submit a working demo and a report by **December 1**.

**Why:** the checkpoint shows that the idea works and that the rest of the year is planned.
It does not need to be perfect. It needs to be **clear, working and honest** about what is still missing.

**Rule for this week: no new features.** Only fix, polish, record and write.

| Day | Work |
| --- | --- |
| Mon | Task 1: fix the roughest edges |
| Tue | Task 2: demo script + recording |
| Wed–Fri | Task 3: the report |
| Sat | Task 4: read it once more, ask someone to read it |
| Sun–Mon | Task 5: buffer + **submit** |

**Before you start:** check the exact submission rules (format, page limit, where to upload, video allowed?)
on your university's page or with your supervisor. Write them at the top of this file.

---

## Task 1 · Fix the roughest edges (about 1 day)

Run the full demo 3 times from a fresh start and write down everything that looks broken or confusing.
Then fix only the things a viewer would notice in a 3-minute demo:

- [ ] Starting the server + web app works from the README instructions (try it as if you were a stranger)
- [ ] A debate runs start to finish without errors
- [ ] Status colours and edge animation are clear
- [ ] The message log and the graph agree
- [ ] A past run opens correctly
- [ ] An error (Ollama stopped) shows as an error, not as a frozen screen
- [ ] No console errors in the browser (open DevTools → Console)

Everything else goes into a "Known issues" list. **That list goes into the report.** Honesty scores better than hiding.

**Done when:** you can run the demo 3 times in a row without touching the code.

---

## Task 2 · Demo script and recording (about 1 day)

1. **Write the script first** (about 3 minutes, ~400 words spoken):

   | Time | Show | Say |
   | --- | --- | --- |
   | 0:00 | Title slide or the app | The problem: multi-agent systems are hard to follow |
   | 0:20 | AutoGen Studio / CrewAI screenshots | What existing tools show, and what they miss |
   | 0:50 | Create an agent | Teams are made of agents with a role |
   | 1:20 | Start a debate, graph lights up live | Who is talking to whom, right now |
   | 2:10 | Message log next to the graph | Same run, text view (this is what the study compares) |
   | 2:30 | Open a past run | Every event is saved locally |
   | 2:45 | Roadmap slide | Next: team builder, inspector, replay, user study |

2. **Record** with QuickTime (File → New Screen Recording) or the macOS screenshot bar (Cmd+Shift+5).
   Record the voice separately if speaking while clicking is hard. That's fine.

3. **Speed tip:** the 8B model is slow. Either cut the waiting parts in editing, or say "this is sped up 2×".
   Never pretend it is faster than it is.

4. Take 4–6 clean screenshots for the report: the graph mid-run, the message log, a past run, the agent form.

**Done when:** you have a video file under ~3 minutes and the screenshots.

---

## Task 3 · The checkpoint report (about 3 days)

Most of it already exists. This week you **combine and polish**, not write from zero.

| Section | Source | Pages (guide) |
| --- | --- | --- |
| 1. Introduction and problem | New, short; use the proposal | 1–2 |
| 2. Aims and objectives | The proposal | 1 |
| 3. Literature review + comparison table | Week 3 draft | 4–6 |
| 4. Requirements | Week 6 | 3–5 |
| 5. Architecture | Week 6 | 4–6 |
| 6. Progress so far | New: what works, with screenshots | 2–3 |
| 7. Known issues and risks | Task 1 list + risks below | 1 |
| 8. Plan for the rest of the year | ROADMAP Part B (December–April) | 1–2 |
| References | Zotero | — |

**Risks to mention** (with what you'll do about each):

- The 8B model is slow and sometimes ignores instructions → keep tasks short; this is also a finding.
- User study recruitment → start asking classmates in February.
- Ethics approval for the study → ask in December (see `docs/december.md`).
- Time: one person, 5 months → the "Could" requirements are optional.

**Writing tips:**

- One idea per paragraph. Start each paragraph with its main sentence.
- Every claim about another tool needs evidence: a screenshot, a citation, or "in my test on 16 October…".
- Use figures: the architecture diagram, the event sequence, the graph screenshot.
- Write "I" or "this project", not "we" (unless your university says otherwise).

**Done when:** every section has content, every figure has a caption, every citation is in the reference list.

---

## Task 4 · Review (about 1 day)

1. Read the whole report aloud once. You'll hear the unclear sentences.
2. Ask one person (a classmate, or your supervisor if they offered) to read the Introduction and the Progress section.
   Ask them: "After reading, what does my platform do and why is it needed?"
   If their answer is wrong, the Introduction needs work.
3. Check: page numbers, figure numbers, table of contents, your name, student number, title.

---

## Task 5 · Buffer and submit

Keep at least one full day free. Something always goes wrong at the end (export, upload, a broken figure).

- [ ] Export the report to PDF and open the PDF to check it
- [ ] Upload the video (or the link, if that's the rule)
- [ ] **Submit by December 1**
- [ ] Commit and tag the code: `git tag checkpoint-40` so you can always find this version
- [ ] Diary entry: what went well, what you'd plan differently

---

## End of week checklist

- [ ] Demo runs 3 times in a row without code changes
- [ ] 3-minute video + screenshots
- [ ] Report complete, read once more, reviewed by one person
- [ ] Submitted
- [ ] Tick the tasks in the [roadmap tracker](https://claude.ai/artifact/SNVKp1dvsXVKaEBKAx5k5p)

**Then take two days off.** December starts the second half.
