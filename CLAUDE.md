# Repo guide

Two independent projects live here:

- `tabletop-trainer/` — **active project**: daily board-game puzzle web app (Catan
  settlement placement MVP). Start with `tabletop-trainer/docs/PLAN.md` and
  `docs/ARCHITECTURE.md`.
- `schemas/`, `samples/`, `workflows/`, `web/` — legacy media-annotation project.
  Do not modify unless explicitly asked.

## Commands (run inside `tabletop-trainer/`)

- `npm install` — setup
- `npm test` — Vitest engine tests (must pass before any commit)
- `npm run build` — typecheck (strict) + production build (must be clean)
- `npm run dev` — local dev server

## Working rules

- The game engine (`src/engine/`) is **pure and deterministic**: no `Date.now()`,
  no `Math.random()` — randomness only via the seeded RNG in `src/engine/rng.ts`.
  Same seed must always produce the same board and the same opponent moves.
- Engine changes require tests in the same commit. UI code never reimplements
  engine logic — it calls it.
- Scoring must stay **explainable**: `evaluate.ts` returns a component breakdown
  that `coach.ts` turns into sentences. Never collapse it to an opaque number.
- Repeatable tasks have skills: `/add-game-adapter`, `/add-opponent-personality`,
  `/tune-heuristics`. Use them instead of improvising.
- Before pushing: run tests + build, then the `puzzle-reviewer` agent checklist
  (`.claude/agents/puzzle-reviewer.md`); use `/code-review` and `/security-review`
  for larger changes.

## Security (non-negotiable)

- Never commit secrets. `.env*` is gitignored; only `.env.example` with placeholder
  values is tracked. If a key is ever committed, rotate it — removing the commit is
  not enough.
- The client bundle must contain no API keys. Any future Claude API coaching calls
  go through a server/edge proxy that holds `ANTHROPIC_API_KEY` server-side.
- Keep runtime dependencies to React only; justify any new dependency in the PR.
