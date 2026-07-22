---
name: add-opponent-personality
description: Add or modify an opponent agent personality (e.g. a new difficulty tier or play style) in Tabletop Trainer. Use when asked for new/smarter/easier opponents.
---

# Add an opponent personality

1. Define the style in one sentence ("values ports early", "hates sharing numbers").
   If it can't be described in one sentence, it's a heuristic change — use
   `/tune-heuristics` instead.

2. Implement in `src/engine/<game>/opponents.ts`:
   - Add the name to the `Personality` union and `OPPONENT_PROFILES`.
   - Express the style as a **re-weighting of the existing `ScoreBreakdown`
     components** (plus, for adversarial styles, the victim's score for the same
     move). Do not fork the evaluator.
   - All tie-breaking randomness comes from the passed-in seeded RNG.

3. Tests (`__tests__/opponents.test.ts`):
   - Same seed twice ⇒ identical move sequence.
   - Every chosen move is legal across ≥20 seeds.
   - A behavioral assertion that distinguishes the personality (e.g. blocker
     takes the user's best vertex in a constructed position where greedy doesn't).

4. Update the personality table in `docs/PLAN.md` and give the agent a display
   name in the UI seat legend.
