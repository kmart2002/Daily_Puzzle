# Tabletop Trainer — Project Summary

*Everything built so far, in one document. Last updated: 2026-07-22.*

Daily board-game puzzles in the spirit of chess puzzles and NYT/LinkedIn daily
games. The first game is **Catan starting placement**: a seeded daily board, a
4-player snake draft against AI opponents, and a coaching agent that grades
every settlement *and* road you place, then explains — in competitive-play
terms — what you got right and what you gave up.

**Try it:** `npm install && npm run dev` inside `tabletop-trainer/`, or see the
PR: https://github.com/kmart2002/improved-engine/pull/2

---

## 1. What was built, in order

### Phase 1 — Plan, architecture, and the engineering "team"
- `docs/PLAN.md` — product vision, MVP scope, phased roadmap, security posture.
- `docs/ARCHITECTURE.md` — mermaid diagrams: system overview, the multi-step
  puzzle sequence, the game-adapter contract, board topology, scoring model.
- `.claude/agents/` — four persistent agent roles so repeated work is done
  consistently: **game-researcher** (produces sourced strategy specs before any
  code), **engine-dev** (deterministic engine modules + tests), **ui-dev**
  (React/SVG board, never reimplements game logic), **puzzle-reviewer**
  (pre-merge checklist: rules correctness, determinism, security).
- `.claude/skills/` — repeatable-task playbooks: `/add-game-adapter` (how a new
  game like Monopoly or Innovation gets added), `/add-opponent-personality`,
  `/tune-heuristics` (safe procedure for changing scoring weights).

### Phase 2 — Deterministic Catan engine (`src/engine/`)
- **Seeded RNG** (`rng.ts`): the only randomness source allowed in the engine.
  A seed string fully determines the board, every opponent move, and every
  score — which makes daily puzzles shareable and every game replayable.
- **Board topology** (`catan/board.ts`): axial hex coordinates, canonical
  `(q, r, N|S)` vertex identity (no floating-point tricks), edge topology for
  roads, the 30-vertex coast ring for ports, shared geometry helpers so the UI
  and engine can never disagree about positions.
- **Board generator** (`catan/generator.ts`): exact standard pools (19 hexes,
  18 tokens, 9 ports), the official "no adjacent 6/8" rule via rejection
  sampling, ports placed around the coast with the standard gap rhythm.
- **Rules** (`catan/rules.ts`): the distance rule for settlements; setup roads
  must attach to the settlement just placed (official setup procedure).
- **Explainable scoring** (`catan/evaluate.ts`): every candidate spot gets a
  component breakdown — raw pips, scarcity-weighted pips, resource diversity,
  engine combos (ore+grain / brick+lumber), port synergy, expansion room, and
  a roll-coverage penalty for stacking numbers you already own. Never a bare
  number: each component maps to a coach sentence.

### Phase 3 — Opponent agents and the coaching agent
- **Three opponent personalities** (`catan/opponents.ts`), all reusing the same
  explainable evaluator with different weightings:
  - *Greedy Gretel* — maximum raw pips, no questions asked
  - *Balanced Boris* — full heuristic score
  - *Blocker Bianca* — values a spot extra because **you** wanted it
  Opponents also aim their setup roads at the best reachable expansion spot.
- **Coach** (`catan/coach.ts`): grades each of your settlements and roads S–D
  against the full ranking of options you actually had, with plain-language
  reasons, top-3 hints on demand, and a "podium" view (see Phase 5).
- **Puzzle state machine** (`catan/puzzle.ts`): 4-player snake draft
  (1-2-3-4-4-3-2-1), you in seat 3, each turn = settlement + attached road.
  Your four decisions (2 settlements, 2 roads) are the puzzle.

### Phase 4 — Interactive board (`src/ui/`)
SVG board with clickable vertices and road edges (keyboard accessible, aria
labels describe each spot), number tokens with probability pips (red 6/8),
coastal ports, player-colored settlements and roads, pulsing legal-move
affordances, a draft log, seat legend, and graded report cards.

### Phase 5 — Feedback round (from playtesting)
- **Podium overlays**: each graded turn can spotlight the top-3 spots on the
  board regardless of what you picked (your pick marked with its rank), plus
  the best road direction and its target.
- **Research-backed coaching**: the game-researcher agent produced
  `docs/specs/catan-opening.md` — a sourced spec of competitive opening
  theory (pip bands, OWS vs wood-brick archetypes, scarcity-as-leverage, roll
  coverage, port traps, road aiming, seat dynamics, blocking thresholds). It
  deliberately excluded unverifiable "tournament statistics" from SEO sites.
  The coach now explains decisions in these terms, and the research exposed a
  real engine gap — roll coverage — which became a new scored component with
  a golden regression test.
- **Daily set of five**: five date-seeded puzzles per day (same for everyone),
  a 1–5 picker in the header, and `?seed=` deep links.
- **Daily email pipeline**: a scheduled GitHub Action emails the day's five
  puzzle links each morning (default recipient configurable), and a Pages
  workflow hosts the app. Requires two repo secrets to activate (see §4).

---

## 2. Engineering practices

- **Determinism is enforced, not hoped for**: no `Math.random()` or `Date` in
  the engine; the reviewer checklist greps for violations; tests assert that
  the same seed twice produces identical games down to the coach grades.
- **31 Vitest tests**: topology invariants (19 hexes / 54 vertices / 30-vertex
  coast), exact tile/token/port pools, the 6/8 rule, the distance rule, setup
  road attachment, golden scoring positions (including the roll-coverage
  case), full-draft simulation with legality replay, determinism.
- **Strict TypeScript**, clean production build, zero runtime dependencies
  beyond React.
- **Verified end-to-end** in headless Chromium (scripted playthroughs +
  screenshots) before every push.
- **Cost-tiered model delegation** (documented in the repo `CLAUDE.md`):
  research/UI/review work runs on cheaper models (Sonnet), engine
  implementation against a spec on Opus, and architecture/heuristics/security
  stays with the lead. Agent definitions pin their tier so this happens by
  default.

## 3. Security posture

- **No secrets exist anywhere in the codebase** — the app is fully
  client-side. `.env*` is gitignored; only `.env.example` with placeholders is
  tracked.
- Email credentials live exclusively in **GitHub Actions secrets**
  (`MAIL_USERNAME`, `MAIL_PASSWORD`), referenced by the workflow, never in code.
- The planned Claude-powered coach narrative (phase 2 roadmap) is specified to
  run behind a server/edge proxy so `ANTHROPIC_API_KEY` can never reach the
  browser bundle.
- The seed deep-link parameter is validated against a strict pattern; no
  user-supplied content is rendered as HTML.

## 4. Activation checklist (owner actions)

After merging the PR:

1. **Settings → Pages** → Source: **GitHub Actions** (hosts the app at
   `/tabletop-trainer/`, preserving the existing site at the root).
2. **Settings → Secrets and variables → Actions**: add `MAIL_USERNAME` (sending
   Gmail address) and `MAIL_PASSWORD` (a Gmail **App Password**, not a real
   password). Optional variables: `PUZZLE_EMAIL_TO`, `PUZZLE_APP_URL`.
3. **Actions tab → "Daily puzzle email" → Run workflow** for a test send.

## 5. Roadmap (not yet built)

1. Blocking advice as a scored component for the *player* (the research spec
   flags this; today blocking only drives the opponent AI and post-hoc credit).
2. Robber-placement and trade-decision puzzles; per-personality road styles.
3. Claude-API coach narratives via an edge proxy (key stays server-side).
4. New game adapters via `/add-game-adapter`: Monopoly opening buys,
   Innovation opening melds.
5. Streaks, shareable result cards, score history.

## 6. Repo map

```
CLAUDE.md                     working rules, delegation policy, security rules
.claude/agents/               game-researcher · engine-dev · ui-dev · puzzle-reviewer
.claude/skills/               add-game-adapter · add-opponent-personality · tune-heuristics
.github/workflows/            daily-puzzle-email.yml · deploy-pages.yml
tabletop-trainer/
  docs/PLAN.md                vision, scope, roadmap
  docs/ARCHITECTURE.md        mermaid diagrams
  docs/specs/catan-opening.md sourced competitive-play spec behind the coach
  src/engine/                 pure deterministic engine (+ 31 tests)
  src/ui/                     SVG board + coach panel
  scripts/daily-email.mjs     generates the daily email
```
