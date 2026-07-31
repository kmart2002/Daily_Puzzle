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
  `/tune-heuristics`, `/add-edge-function`, `/design-architecture`. Use them
  instead of improvising, and add a new skill whenever a task recurs.
- Server code (`supabase/`) follows one rule: **the client sends intent, the
  server decides outcomes**. Pure logic lives in `src/server/` or `src/engine/`
  with tests; Edge Functions stay thin IO wrappers.
- Before pushing: run tests + build, then the `puzzle-reviewer` agent checklist
  (`.claude/agents/puzzle-reviewer.md`); use `/code-review` and `/security-review`
  for larger changes.

## Model delegation policy (cost control)

Use the cheapest model that can do the job well; reserve the top model for work
where its judgment actually pays for itself. When spawning subagents, the agent
definitions below already pin the right tier — don't override upward without a
reason.

| Tier | Model | Use for |
|---|---|---|
| Cheap | **Sonnet** | UI components & styling (`ui-dev`), docs, rules/strategy research (`game-researcher`), review passes (`puzzle-reviewer`), routine test additions, mechanical refactors |
| Middle | **Opus** | Engine module implementation against an existing spec (`engine-dev`), non-trivial debugging |
| Top | Fable (lead session) | Architecture and API contracts, novel topology/scoring math, heuristic design, cross-cutting changes, security-sensitive work, final integration & judgment calls |

Rules of thumb:

- Delegate work that is **well-specified and verifiable** (tests + build must
  pass) — the lead defines the contract, the subagent fills it in.
- Don't delegate work whose spec would be longer than the diff, or anything
  touching determinism guarantees or the scoring/coach contract without the
  lead reviewing the result.
- Batch small related tasks into one subagent run rather than many spawns —
  each spawn re-reads context, which is where the cost hides.

## Security (non-negotiable)

- Never commit secrets. `.env*` is gitignored; only `.env.example` with placeholder
  values is tracked. If a key is ever committed, rotate it — removing the commit is
  not enough.
- The client bundle must contain no API keys. Any future Claude API coaching calls
  go through a server/edge proxy that holds `ANTHROPIC_API_KEY` server-side.
- Keep runtime dependencies to React only; justify any new dependency in the PR.
