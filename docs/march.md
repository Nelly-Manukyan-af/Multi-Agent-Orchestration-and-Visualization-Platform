# March · Evaluation

**Goal:** show with data whether the graph view helps, and measure how the system performs.

**Why:** this is the evidence for your thesis's main claim. Two kinds of evaluation:

1. **User study:** do people find problems faster and more correctly with the graph than with a text log?
2. **Technical metrics:** is the system fast and correct enough to be usable?

| Week | Work |
| --- | --- |
| Mar 1–7 | Task 1: recruit · Task 4: technical metrics |
| Mar 8–21 | Task 2: run the sessions (about 2 per day) |
| Mar 22–28 | Task 3: analyse the study |
| Mar 29–31 | Task 5: Evaluation chapter draft |

**Before you start:** ethics approval (if needed) must be confirmed. **Don't run sessions without it.**

---

## Task 1 · Recruit 8–12 participants (start in late February)

**Who:** students who know some programming (software engineering, computer science).
They don't need to know LLMs. Your 2-minute intro covers that.

**How:**

- A short message in course group chats: what it is, how long (30 min), when, where (or online), and that it's anonymous.
- Ask 15 people to get 10. Some will cancel.
- Book fixed time slots (a shared calendar or a simple sign-up table).
- If your university allows it, a small thank-you (coffee, sweets) helps a lot.

**Assign each participant** a code (`P01`, `P02`, …) and an order:
odd numbers start with the graph, even numbers with the log. Write this table **before** the sessions.

---

## Task 2 · Run the sessions (about 2 weeks)

**Before each session:**

- [ ] Server and web app running, study mode tested
- [ ] Correct participant code and order
- [ ] Consent form ready (paper or online)
- [ ] Your script printed: read the same instructions to everyone, word for word

**During:**

- Don't help with the task. If they ask, say "do what you think is right".
- Write short notes about what they say and do (where they click, what confuses them).
  These quotes make the Evaluation chapter much stronger.

**After each session:** check the CSV row was saved. Write 2–3 lines in the diary.

---

## Task 3 · Analyse the study (about 1 week)

You have, per participant and per view: correct answers (out of 3), average time, average confidence, SUS score.

**1. Descriptive statistics.** For each view: mean, median, minimum, maximum. A table and box plots.

**2. Statistical test.** Each person used both views, so the data is **paired**.
With ~10 people and data that may not be normally distributed, use the **Wilcoxon signed-rank test**
(the paired, non-parametric test). Do it in Python with `scipy.stats.wilcoxon`, or in a spreadsheet with an online calculator.

Report it honestly:
- "Participants were faster with the graph (median 64 s vs 98 s; Wilcoxon, p = 0.03, n = 10)", or
- "No significant difference in correctness (p = 0.41); with n = 10 the study can only detect large effects."

**A non-significant result is still a valid result.** Never change the analysis after seeing the numbers to get a "nicer" p-value.

**3. SUS.** Average score per view. Above ~68 is usually called "above average"; cite the source you use.

**4. Qualitative.** Group the notes and quotes into themes (e.g. "the graph made the skipped agent obvious",
"the log was better for reading exact text"). 3–5 themes with 1–2 quotes each.

**5. Order effect check.** Compare graph-first vs log-first participants. Did the order matter?

**Charts** (matplotlib or Recharts screenshots): box plot of time per view, bar chart of correct answers per view, SUS per view.

---

## Task 4 · Technical metrics (about 2–3 days)

Measure with the scripts and data you already have:

| Metric | How | Why it matters |
| --- | --- | --- |
| **Event delay** | Browser time when an event arrives minus `event.timestamp` (same machine, so the clocks agree) | Is "live" really live? |
| **Run time** per pattern | `run_finished` minus `run_started`, 5 runs each | What users wait for |
| **Tokens** per pattern | Sum from `llm_response` | Cost if a paid model were used; prompt growth in group chat |
| **Replay speed** | Time to redraw at any slider position for a long run | Is scrubbing smooth? |
| **Storage** | Database size per run | Can it keep months of runs? |

Run each measurement **at least 5 times** and report the median and the range. Write down the machine
(M1 Pro, 16 GB, qwen3:8b), because results depend on it.

---

## Task 5 · Evaluation chapter draft (about 3 days)

Suggested structure, 8–12 pages:

1. **Method:** research question, design, participants (number, background, no names), procedure,
   planted problems, measures, ethics, pilot
2. **Results, user study:** tables, charts, tests, SUS, themes with quotes
3. **Results, technical:** the metrics table
4. **Discussion:** what the results mean; when the graph helped and when the log was better
5. **Threats to validity:** small sample; students only; planted problems may be easier than real ones;
   you built the tool and ran the study (possible bias); one model and one laptop

**Done when:** a full draft exists. You polish it in April.

---

## End of month checklist

- [ ] 8–12 sessions done, all CSV data saved
- [ ] Statistics and charts done
- [ ] Technical metrics measured (5 runs each)
- [ ] Evaluation chapter: full draft
- [ ] Diary entries for each week
- [ ] Tick the tasks in the [roadmap tracker](https://claude.ai/artifact/SNVKp1dvsXVKaEBKAx5k5p)
