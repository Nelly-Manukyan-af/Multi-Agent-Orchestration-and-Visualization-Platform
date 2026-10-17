# April · Thesis and presentation (deadline)

**Goal:** a finished thesis, a working demo, and a presentation, submitted on time.

**Before you start:** confirm the **exact submission date**, the page limit, the template, and the presentation format
with your university. (The roadmap only says "April".) Write them here:

- Submission date: …
- Page limit / template: …
- Presentation date and length: …

**Rule for this month: the code is frozen** except for bug fixes. Tag it: `git tag thesis-final` when done.

| Week | Work |
| --- | --- |
| Apr 1–7 | Task 1: Implementation chapter final · Task 2: Introduction |
| Apr 8–14 | Task 3: Conclusion · Task 4: put the thesis together |
| Apr 15–21 | Task 5: review and fixes · Task 6: presentation |
| Apr 22 → deadline | Task 7: demo backup, rehearsal, **submit** |

(Move the weeks to fit your real deadline. Keep the last week as a buffer.)

---

## Task 1 · Implementation chapter: final version (about 3 days)

You drafted it in January. Now:

- Add December–February work: patterns, team builder, inspector, replay, study mode, setup
- Every important claim → a figure, a code excerpt (short!), or a diary reference
- Remove code dumps longer than ~15 lines; explain the idea instead
- Check that every requirement from the Requirements chapter is either implemented (say where)
  or explicitly not done (say why)

A **requirements traceability table** is a good way to finish the chapter:

| Requirement | Status | Where |
| --- | --- | --- |
| F1 Live graph | Done | Section 5.3, Figure 12 |
| F5 Replay | Done | Section 5.6 |
| F9 Pause and edit | Not done | Chose "compare runs" instead (Section 5.8) |

---

## Task 2 · Introduction (about 2 days)

Write it **after** the other chapters. Now you know exactly what the thesis says.

1. **Context:** LLM agents and multi-agent systems are growing fast
2. **Problem:** it's hard to see what a team of agents is doing and why it fails (one real example from your tests)
3. **Aim and research question**
4. **Contribution:** a local, free platform that shows agent teams as a live graph with inspection and replay,
   plus a user study comparing it with a text log
5. **Structure of the thesis:** one sentence per chapter

---

## Task 3 · Conclusion (about 1 day)

1. Answer the research question directly, using your results
2. What the project achieved (match the aims from the Introduction)
3. Limitations (short; the details are in the Evaluation chapter)
4. **Future work:** e.g. more patterns, bigger models, a larger study, editing runs, collaboration features

No new results in the Conclusion.

---

## Task 4 · Put the thesis together (about 2 days)

- [ ] Abstract (write it last; ~250 words: problem, approach, results with numbers, conclusion)
- [ ] Table of contents, list of figures, list of tables
- [ ] Every figure and table numbered and mentioned in the text
- [ ] References complete and in one style (export from Zotero)
- [ ] Appendices: study protocol, SUS questionnaire, consent form, planted-problem descriptions, how to run the code
- [ ] Acknowledgements (optional)

---

## Task 5 · Review and fixes (about 4 days)

1. Send the full draft to your supervisor **at least 2 weeks before the deadline** (ask them how much time they need).
2. While waiting: read the whole thesis aloud once, chapter by chapter, on different days.
3. Check consistency: the same names everywhere ("message log" vs "text view": pick one), the same tense.
4. Apply the supervisor's feedback. Keep a list of what you changed.

---

## Task 6 · Presentation (about 3 days)

Typical length: 15–20 minutes + questions (check yours).

| Part | Slides | Time |
| --- | --- | --- |
| Problem + one real failure example (CrewAI's skipped Writer is a good one) | 2–3 | 3 min |
| Existing tools and the gap | 1–2 | 2 min |
| Your platform: architecture in one picture | 1–2 | 2 min |
| **Live demo** | — | 5 min |
| Study and results | 3–4 | 4 min |
| Conclusion + future work | 1 | 1 min |

**Likely questions, prepare an answer for each:**
- Why build your own orchestrator instead of using AutoGen, CrewAI or LangGraph?
- Why TypeScript when most agent frameworks are Python?
- Would the results be different with a bigger model?
- Isn't n = 10 too small?
- What would you do differently?

---

## Task 7 · Demo backup, rehearsal, submit

- [ ] **Recorded backup video** of the full demo. Live demos fail: Wi-Fi, a slow model, a sleeping laptop.
- [ ] Pre-recorded runs ready to replay, in case the model is too slow live
- [ ] Laptop: charger, display adapter, notifications off, Ollama started, model already loaded (run one request before)
- [ ] Rehearse the full presentation at least twice, with a timer, once in front of someone
- [ ] Export the thesis to PDF, open and check the PDF
- [ ] **Submit before the deadline** (not on the last hour)
- [ ] `git tag thesis-final` and push
- [ ] Last diary entry 🎉

---

## End of month checklist

- [ ] All chapters final
- [ ] Supervisor feedback applied
- [ ] Presentation + backup video + rehearsed
- [ ] Thesis submitted
- [ ] Code tagged
- [ ] Tick the last tasks in the [roadmap tracker](https://claude.ai/artifact/SNVKp1dvsXVKaEBKAx5k5p)
