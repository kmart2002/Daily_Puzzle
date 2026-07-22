---
name: add-game-adapter
description: Repeatable checklist for adding a new board game (or a new decision type within a game) to Tabletop Trainer. Use when asked to support a new game like Monopoly or Innovation, or a new Catan puzzle type.
---

# Add a game adapter

Follow this order — do not skip the spec step.

1. **Spec first.** Run the `game-researcher` agent (or write it yourself) to produce
   `tabletop-trainer/docs/specs/<game>-<decision>.md`: exact rules, scoring components
   with weights, and 3–5 golden positions (board state → best move, bad move).

2. **Scaffold** `tabletop-trainer/src/engine/<game>/` mirroring `catan/`:
   - `types.ts` — board/move/placement types for this game
   - `generator.ts` — `generate(seed: string): Board`, seeded RNG only
   - `rules.ts` — `legalMoves(board, placements): Move[]`
   - `evaluate.ts` — `score(...): ScoreBreakdown` (component breakdown, never a bare number)
   - `opponents.ts` — at least `greedy` and `balanced` personalities over the same breakdown
   - `coach.ts` — grade S–D + sentences, one sentence per breakdown component
   - `puzzle.ts` — turn order / state machine for the multi-step puzzle

3. **Tests** in `src/engine/<game>/__tests__/`, in this order:
   - generation invariants (piece counts, structural rules) and same-seed determinism
   - legality edge cases from the rulebook
   - golden positions from the spec: best move ranks #1 (or near), bad move grades ≤ C
   - full-puzzle simulation: all agents finish, every move legal

4. **UI adapter**: a `<Game>BoardView` in `src/ui/` using engine geometry helpers.
   Wire into the game switcher in `App.tsx`. No rules logic in components.

5. **Gate**: `npm test` + `npm run build` clean, then run the `puzzle-reviewer`
   agent checklist before pushing.
