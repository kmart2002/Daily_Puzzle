# Architecture

## System overview

```mermaid
flowchart LR
    subgraph Browser["Browser (static site — no secrets)"]
        UI["React UI\nBoardView / CoachPanel / Controls"]
        State["Session state\n(immutable PuzzleSession)"]
        subgraph Engine["Game engine (pure TS, deterministic)"]
            Gen["generator.ts\nseeded board"]
            Topo["board.ts\nhex/vertex topology"]
            Rules["rules.ts\nlegality"]
            Eval["evaluate.ts\nscore breakdown"]
            Opp["opponents.ts\nagent personalities"]
            Coach["coach.ts\ngrades + explanations"]
            Sess["puzzle.ts\nsnake-draft state machine"]
        end
    end
    Daily["Date string\n(daily seed)"] --> Gen
    UI --> State --> Sess
    Sess --> Rules & Opp & Coach
    Opp --> Eval
    Coach --> Eval
    Eval --> Topo
    Gen --> Topo

    subgraph Future["Phase 2 (not in MVP)"]
        Proxy["Edge proxy\n(holds ANTHROPIC_API_KEY)"]
        Claude["Claude API\nnarrative coaching"]
    end
    Coach -. optional narrative .-> Proxy --> Claude
```

Key property: **everything left of the dashed line is deterministic and secret-free.**
Same seed ⇒ same board, same opponent moves, same scores. That makes daily puzzles
shareable, tests reproducible, and the coach's advice explainable.

## Puzzle flow (multi-step)

```mermaid
sequenceDiagram
    actor U as You (seat 3 of 4)
    participant S as PuzzleSession
    participant O as Opponent agents
    participant C as Coaching agent

    Note over S: seed = today's date → board generated
    S->>O: seats 1–2 place (snake draft)
    O-->>S: settlements placed
    U->>S: click a vertex (step 1)
    S->>C: grade placement vs. all legal alternatives
    C-->>U: grade S–D + why + best alternative
    S->>O: seat 4 places twice (snake turn)
    O-->>S: settlements placed
    U->>S: click a vertex (step 2)
    S->>C: grade (now weighs synergy with your 1st pick)
    C-->>U: grade + final report
    S->>O: seats 2–1 finish the draft
    Note over U,C: summary — grades, best-spot overlay, retry / new puzzle
```

## Engine module contract (game adapters)

Each game lives in `src/engine/<game>/` and exposes the same shape, so the UI and
puzzle shell stay game-agnostic:

```mermaid
classDiagram
    class GameAdapter {
        generate(seed) Board
        legalMoves(board, placements) Move[]
        score(board, placements, player, move) ScoreBreakdown
        opponentMove(board, placements, player, profile, rng) Move
        coach(board, placements, player, move) CoachReport
    }
    GameAdapter <|-- Catan
    GameAdapter <|-- Monopoly~phase 3~
    GameAdapter <|-- Innovation~phase 3~
```

## Catan board topology

Axial hex coordinates `(q, r)` with radius 2 → 19 hexes. Vertices use the canonical
`(q, r, N|S)` scheme (every vertex in a pointy-top hex grid is the **N**orth corner of
exactly one hex column position or the **S**outh corner of one), which gives exact
identity — no floating-point deduplication:

- Corners of hex `(q,r)`: `(q,r,N)`, `(q+1,r-1,S)`, `(q,r+1,N)`, `(q,r,S)`, `(q-1,r+1,N)`, `(q,r-1,S)`
- Hexes touching `(q,r,N)`: `(q,r)`, `(q,r-1)`, `(q+1,r-1)`
- Vertex neighbors of `(q,r,N)`: `(q,r-1,S)`, `(q+1,r-1,S)`, `(q+1,r-2,S)` (mirror for `S`)

The 30-vertex coast ring is walked to place the 9 ports (4× 3:1, 5× 2:1) with the
standard 1-1-2 gap rhythm.

## Scoring model (explainable by design)

`evaluate.ts` returns a **breakdown**, not just a number, so the coach can explain
every point:

| Component | Meaning |
|---|---|
| `pips` | Raw production (probability dots of adjacent tokens) |
| `weightedPips` | Pips weighted by board-wide scarcity of each resource |
| `diversityBonus` | New resource types this placement adds for the player |
| `comboBonus` | Completes brick+lumber (roads) or ore+grain (cities/dev) |
| `portBonus` | 3:1 or 2:1 port, scaled by matching production |
| `expansionBonus` | Nearby vertices still open for future settlements |

Opponent personalities reuse the same breakdown with different weightings; the
**blocker** additionally values a vertex by how much *you* wanted it.
