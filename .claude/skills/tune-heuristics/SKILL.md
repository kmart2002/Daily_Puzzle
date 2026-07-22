---
name: tune-heuristics
description: Safely change evaluation/scoring weights in Tabletop Trainer without silently changing coach advice or breaking golden positions. Use for any change to evaluate.ts weights or components.
---

# Tune scoring heuristics

Scoring is the product — a bad weight change makes the coach give bad advice.

1. **Before changing anything**, record the baseline: run `npm test` and note the
   golden-position tests in `__tests__/evaluate.test.ts`; run a quick ranking dump
   for 5 fixed seeds (top-3 vertices per seed) and save it to the scratchpad.

2. Make the change:
   - New component ⇒ add it to `ScoreBreakdown`, the evaluator, **and** a matching
     sentence in `coach.ts`. A component the coach can't explain is a defect.
   - Weight change ⇒ change it in exactly one place (the weights constant), never
     inline.

3. Validate:
   - Golden positions still pass (best move still #1, bad move still ≤ C). If a
     golden position changed on purpose, update the spec doc in `docs/specs/`
     with the reasoning — never just edit the test.
   - Re-run the 5-seed ranking dump and diff against baseline; summarize what
     moved and why in the commit message.
   - Determinism: same seed twice ⇒ identical rankings.

4. `npm test` + `npm run build`, then `puzzle-reviewer` checklist.
