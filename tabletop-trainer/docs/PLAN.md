# Tabletop Trainer — Product & Engineering Plan

Daily-puzzle trainer for board game decisions, in the spirit of chess puzzles and
NYT/LinkedIn daily games — but the "puzzle" is a board game decision, starting with
**optimal Catan starting-settlement placement** given the board tiles and what
opponents have already placed.

## Vision

- One short, high-quality puzzle per day (seeded by the date, same board for everyone).
- Multi-step puzzles: you place, **opponent agents** respond, you place again.
- A **coaching agent** grades every decision you make, explains *why* it was good or
  bad, and shows the best alternative.
- Game-agnostic core so new games (Monopoly opening buys, Innovation opening melds,
  Catan robber decisions, …) plug in as adapters.

## MVP (this repo, phase 1) — Catan settlement placement

| Piece | What ships |
|---|---|
| Board engine | Seeded standard 19-hex board (correct tile/token pools, no adjacent 6/8, 9 ports), full vertex/edge topology, distance rule |
| Puzzle flow | 4-player snake draft; you are one seat; opponents auto-place; your two settlement picks are the puzzle steps |
| Opponent agents | Deterministic personalities: **greedy** (raw pips), **balanced** (score-max), **blocker** (denies your best spots) |
| Coaching agent | Ranks all legal vertices with an explainable score breakdown; grades your pick (S–D), explains the gap vs. best in plain language; hint mode |
| Interactive board | SVG hex board: click legal vertices, see tokens/pips/ports, player-colored settlements, hint & best-move overlays |
| Modes | Daily (date seed) + practice (random seed) + retry same board |

Everything runs client-side — no backend, no secrets, deployable as static files.

## Phase 2+ (roadmap, not in MVP)

1. **Roads** in the initial placement (score expansion direction), robber puzzles, trade puzzles.
2. **LLM-powered coach narratives**: richer natural-language coaching via the Claude API.
   *Must* go through a small server/edge function — the API key never ships to the browser
   (see Security below).
3. **More games via adapters** (`src/engine/<game>/` implementing the shared `GameAdapter`
   contract): Monopoly opening property valuation, Innovation opening melds.
4. Streaks, share-your-result cards, score history (localStorage first, then accounts).
5. Opponent difficulty tiers + tuned heuristic weights from self-play benchmarks
   (see `/tune-heuristics` skill).

## Engineering organization (agents & skills)

Repeatable work is encoded so any session — human or agent — does it the same way:

- `.claude/agents/game-researcher.md` — researches a game's rules/strategy literature and
  produces a heuristic spec before any code is written.
- `.claude/agents/engine-dev.md` — implements deterministic engine modules, tests first.
- `.claude/agents/ui-dev.md` — interactive board & panels; never touches engine internals.
- `.claude/agents/puzzle-reviewer.md` — reviews for rules correctness, determinism,
  security; run before every merge.
- `.claude/skills/add-game-adapter` — the repeatable checklist for adding a new game.
- `.claude/skills/add-opponent-personality` — add/verify a new opponent strategy.
- `.claude/skills/tune-heuristics` — safe procedure for changing evaluation weights.

Built-in `/code-review` and `/security-review` run before every push.

## Quality gates (every change)

1. `npm test` — engine is fully unit-tested (topology, generation, legality, scoring,
   full-puzzle simulation). Determinism: same seed ⇒ identical board and opponent moves.
2. `npm run build` — TypeScript strict; the build must be clean.
3. Review pass with `.claude/agents/puzzle-reviewer.md` checklist.

## Security

- **No secrets in this repo, ever.** MVP needs none. `.env*` is gitignored;
  `.env.example` documents future variables with placeholder values only.
- Future LLM coach calls go browser → our server/edge proxy → Anthropic. The key lives
  only in server env config. Client code must never read `ANTHROPIC_API_KEY`.
- No third-party runtime dependencies beyond React — small supply-chain surface.
  New dependencies need a stated reason in the PR.
- All puzzle input is generated locally from a seed; no user-supplied content is
  evaluated or rendered as HTML.
