# Tabletop Trainer

Daily board-game puzzles in the spirit of chess puzzles and NYT/LinkedIn games.
MVP: **Catan starting-settlement placement** — a seeded daily board, a 4-player
snake draft against three opponent agents, and a coaching agent that grades both
of your picks (S–D) and explains exactly what you gave up.

- `docs/PLAN.md` — product vision, MVP scope, roadmap, security posture
- `docs/ARCHITECTURE.md` — mermaid diagrams: system, puzzle sequence, adapter contract

## Run it

```bash
npm install
npm run dev      # local dev server
npm test         # 28 engine tests (topology, rules, scoring, determinism)
npm run build    # strict typecheck + static production build
```

The app is fully client-side and deterministic: the date seeds the daily board,
so everyone gets the same puzzle, and a seed fully determines opponent play.
No backend, no keys, no third-party runtime deps beyond React.

## How to play

1. Two opponents place before you (snake draft — you're seat 3 of 4).
2. Click a highlighted vertex to place your first settlement. Ask the coach for
   a hint if you're stuck.
3. Opponents respond — including **Blocker Bianca**, who will happily steal the
   spot you were saving — then you place your second settlement.
4. The coach's report grades each pick, compares it to the best available
   alternative, and can overlay the best spots on the board. Retry the same
   board or grab a random practice board.

## Repo layout

```
src/engine/rng.ts        seeded RNG — the only randomness source in the engine
src/engine/catan/        board topology · generator · rules · evaluate ·
                         opponents · coach · puzzle state machine (+ tests)
src/ui/                  SVG board + coach panel (no game logic in the UI)
```

Engineering conventions, agent roles, and repeatable-task skills live in the
repo root: `CLAUDE.md`, `.claude/agents/`, `.claude/skills/`.
