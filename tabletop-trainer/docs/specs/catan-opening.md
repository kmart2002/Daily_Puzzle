# Catan Opening: Settlement Placement & Setup Road Direction

**Decision scope:** the two settlement + setup-road placements every player makes
during Catan's initial set-up phase (before turn 1 proper). This spec grounds the
existing `evaluate.ts` scoring model in official rules and competitive-play
consensus, and flags what the current engine does *not* yet model.

## Research note on sources

Web search was available and returned results, but the quality of the underlying
pages was mixed. A cluster of SEO/AI-generated strategy sites (e.g. `playiro.com`,
`kingofcatan.net`, `settlersboard.com`) repeat identical, oddly precise claims
("World Championship trades per game dropped from 22 in 2008 to 6–9 in 2024",
"opening pip totals rose from 12 to 15+") with no cited primary data or box
scores behind them, and direct fetches of those pages returned HTTP 403 (bot
blocked), so their exact wording could not be verified. **Those specific
statistics are not used in this spec.** Where a claim could be cross-checked
against multiple independent sources (BoardGameGeek community threads, the
Catan Fandom wiki, `blog.colonist.io`, `mykindofmeeple.com`, community
Steam/Fandom guides for Catan Universe, and long-standing community consensus
repeated across many independent strategy write-ups) it is included and
labeled as **community consensus** rather than as a verified tournament
statistic. Every principle below is separately grounded in mechanism (why the
rules make it true), not just in "pros say so."

## 1. Rules that constrain the decision

These are hard constraints — get them wrong and the puzzle is not just
sub-optimal, it's illegal. Source: official *CATAN – Rules of Play* (Catan
Studio / Kosmos, current edition, catan.com/download-rules), "Game Set-Up" and
"Building" sections; cross-checked against the Catan Fandom wiki's summary of
the set-up procedure.

1. **Distance rule.** No settlement may be built on a vertex adjacent (one
   edge away) to any existing settlement or city, for any player — including
   your own. Every legal-vertex spot in the engine already enforces this
   (`rules.ts` / `legalVertices`); it's the reason a "best" spot can vanish the
   instant an opponent places nearby.
2. **Set-up order is a snake draft.** With 4 players: seats 1→2→3→4 each place
   one settlement + one connected road, then the order reverses, 4→3→2→1, for
   the second settlement + road. This means seat 4 places twice in a row
   (picks 4 and 5 of 8) with full information, while seat 1 places first (pick
   1, least information) and last (pick 8, most information but the fewest
   spots left).
3. **A road must be attached to the settlement just placed** in set-up (not a
   free road anywhere) — this is why "setup road direction" is a real,
   constrained decision: you're choosing among the (typically 2-3) legal edges
   touching your new settlement, not among all roads on the board.
4. **Only the second settlement produces starting resources** (one resource
   card per adjacent hex, per current rules), paid out immediately when placed.
   This is a real reason the second placement is evaluated with "what do I
   already have" context (diversity/combo bonuses) that the first placement
   cannot use, since nothing has produced yet.
5. **No trading during set-up.** Regular-turn trade actions aren't available
   until turn 1, so a set-up choice can't be patched by a quick trade — this is
   part of why port timing (Section 5) and resource diversity (Section 3/4)
   matter more at set-up than they do later.
6. **Board math**: 19 hexes, 18 produce (1 desert, no token), number tokens
   2–12 excluding 7, with dot counts 2/12→1, 3/11→2, 4/10→3, 5/9→4, 6/8→5 — "pip
   count" in every source below refers to summing these dot counts. 9 harbors:
   4 generic 3:1, 5 resource-specific 2:1 (one per resource). The robber starts
   on the desert and is never placed during set-up.

## 2. Strategy consensus

### 2.1 Pip counting

"Pip count" (sum of dot values on the 2–3 hexes touching a vertex) is the
single most repeated quick metric across every strategy source found — from
casual guides through advanced ones (Everything Is A Game; King of Catan;
Colonist.io; BoardGameGeek strategy thread). Consensus bands, cross-checked
across independent sources:

- **~9 pips or fewer** on a first settlement is a below-average opening; you're
  relying on variance to keep up.
- **10-11 pips** is a solid, safe opening (a 6+8 pair alone is 10 pips before a
  third hex is even added).
- **12-13+ pips**, especially spread across 3 different numbers with no
  repeats, is the pro-consensus target for a strong opening corner.
- A single very hot number (a 6 or 8) touching the spot is treated as close to
  mandatory for a top-tier opening — sources describe strong openings as
  "sitting on at least one 6 or 8."

Multiple SEO sites attach specific win-rate percentages to these bands (e.g.
"14+ pip openings win 60% more often"); those numbers could not be
independently verified and are **not** asserted here as fact, only the
directionally-consistent, widely-repeated ordinal ranking (more pips, spread
across more numbers, is better) is used.

### 2.2 OWS vs Wood-Brick: the two classic archetypes

Both archetypes are named consistently across sources (Colonist.io; multiple
Medium strategy write-ups; Catan Universe community guides; the long-running
BGG strategy thread):

- **Ore-Wheat-Sheep (OWS).** Prioritize ore and wheat (grain) heavily, sheep
  (wool) as the connective third resource, with minimal wood/brick. This funds
  the "city + development card engine": ore+grain repeatedly builds cities
  (2 VP each, doubles production) and buys development cards (VP, knights,
  monopoly/year-of-plenty). Consensus: **preferred when a high-pip ore/wheat
  corner is available**, and disproportionately by players who expect to *not*
  need to win a Longest Road race (because they aren't going to build much
  road anyway).
- **Wood-Brick (road/settlement race).** Prioritize lumber and brick to chain
  roads outward fast, grab a 3rd/4th settlement before opponents can, and
  contest Longest Road. Consensus: preferred **when the board's best open
  corners are on the coast/edges, when your seat position leaves you racing
  for the last good spots** (see 2.7), or simply when no high-pip OWS corner
  survived the earlier picks. It's explicitly a bet that speed beats density.
- Community guides converge that the deciding factor is **board texture and
  seat position**, not a universal "OWS is always better": a 4th or 5th picker
  facing a board already stripped of ore/wheat corners should pivot to
  wood-brick rather than take the best remaining OWS corner if it's mediocre.

### 2.3 Resource scarcity → trading power

Consensus across multiple independent sources (BoardGameGeek strategy thread;
`blog.colonist.io`; board-game-analysis write-ups): a resource that is
*globally* scarce on this particular board (fewer total pips of it across all
18 producing hexes) is worth more per-pip than an abundant one, for two
compounding reasons — (a) you're less likely to be able to buy it from
opponents so producing it yourself matters more, and (b) if you *do* produce
it, you hold **trading leverage**: opponents who lack it must overpay you
(often better than 1:1) to get any. The common concrete example: brick is
often the tightest resource on a standard board layout (one fewer brick hex
than wood in the base tile set), so a spot producing brick reliably has more
practical value than its raw pip count implies, and a player who monopolizes
a scarce resource can extract favorable trades all game. The engine's
`scarcityWeights` function is a direct implementation of this idea (see
Section on mapping below).

### 2.4 Number diversity — the principle, stated correctly

The naive version of this rule ("more distinct numbers = better") is often
stated fuzzily; the *mechanism* consensus sources actually give is more
precise, and it's not just "variance is scary":

- Two settlements sharing the **same** number token (e.g. both touch a 6, or
  both touch an 8) have identical pip totals to two settlements on **different**
  numbers with the same total dots (e.g. one on 6, one on 8) — but they are
  **not equally good**, for two independent reasons:
  1. **Roll coverage.** A stack on the same number only ever produces on that
     one roll each turn; a spread across different numbers produces on more
     of the 11 distinct roll outcomes (2-12) each turn, which smooths
     production and reduces the odds of a multi-turn drought.
  2. **Robber exposure.** The robber can only sit on one number at a time. Two
     settlements sharing a number can both be shut off by a single robber
     placement; two settlements on different numbers require the robber (and
     any card-stealing) to choose which one to hurt, so at most one of your
     two spots is ever blocked at once.
- This is why "6 and 8" (two different hot numbers) is consistently rated
  *better* than "6 and 6" or "8 and 8" even though the pip math is identical —
  the difference isn't in expected value per roll, it's in variance and
  robber-resilience. Confirmed independently across multiple sources
  discussing this exact 6/6-vs-6/8 comparison.

### 2.5 Ports: strong placement vs trap

Consensus (Colonist.io; Catan Universe community guides; multiple independent
write-ups) converges on a single conditional rule: **a 2:1 port is only as
good as the matching production backing it.**

- **Genuinely strong**: a 2:1 port for resource X placed where your
  settlement(s) already produce (or will soon produce) heavy X — you can dump
  surplus X at a good rate, effectively turning excess production into
  whatever you're missing. This is explicitly called out as a trap-avoidance
  rule: "the only reason to want a 2:1 port is if you already have or will
  soon have strong production of that resource."
- **A trap for a first placement**: taking a 2:1 port on a resource your
  *first* settlement barely produces (or a resource you don't need in bulk,
  e.g. a wool port with only 2 wool pips). The port itself produces nothing;
  it only accelerates trades of resources you already have too much of. A
  common beginner mistake flagged repeatedly: choosing a coastal, port-having
  vertex over a strictly higher-production inland vertex "because ports are
  good," without checking the resource match.
- **3:1 generic ports** are treated more forgivingly (flexible with any
  surplus resource) but are still explicitly rated below a matching 2:1 with
  real production, and well below a non-port high-pip corner, for a *first*
  settlement — the generic port's value only really shows up once you have
  diverse production to dump.

### 2.6 Setup road direction

Consensus (multiple independent strategy write-ups, Fandom "Free Settlement
Strategy" article, BGG discussion) treats the setup road as a **direction
commitment**, not a production choice — since the distance rule already
forbids settling the road's own far endpoint, the road's value is entirely in
which future 3rd/4th settlement spot it moves you one step closer to:

- Point the road at the **best legal, still-open spot** it can reach, not
  necessarily straight toward the board center — a common explicit warning is
  that roads toward the crowded center often reach nothing, because every
  other player is also racing toward the center, whereas a coastal or
  edge-ward road can still land a solid, uncontested corner.
- Avoid **dead coastline**: a road direction whose only reachable vertices are
  off-board water or already-illegal (too close to another settlement) wastes
  the pick entirely; the coach should always compare against the alternative
  legal road at the same settlement.
- If a direction is **contested** (an opponent could also reach that same
  future spot in fewer or equal roads), only take that direction if you are
  the one favored to win the race — otherwise, prefer an uncontested direction
  even if its target is slightly weaker in pips.

### 2.7 Seat position / snake draft dynamics

Consensus is consistent about the *shape* of the asymmetry even where exact
numbers vary by source: with 8 total picks in the standard 4-player snake
order (1,2,3,4,4,3,2,1), the earlier a pick falls in that sequence, the more
raw production is still available but the less information you have about
what opponents will take; the later a pick falls, the more informed it is
(you can react and fill gaps or block) but the less raw value is left:

- **Early picks (1st-4th of 8 — everyone's first settlement)**: strategy
  should lean toward **maximizing raw value** — take the highest-scoring
  legal corner available to you, since no opponent has committed to a
  direction yet and there's nothing concrete to react to.
- **Late picks (5th-8th of 8 — everyone's second settlement, in reverse
  order)**: strategy should shift toward **filling gaps and reacting** —
  favor whichever remaining resource/number types your *first* settlement is
  missing (this is exactly what `diversityBonus`/`comboBonus` compute), and
  weigh whether a nearby spot denies a specific opponent's obvious best
  option (blocking, Section 2.8), since by this point you can see everyone's
  first settlements and roads.
- Seats that go early both times (seat 1: picks 1 and 8) get the single
  highest-value first pick but the worst-off second pick (almost everything
  good is gone); seats that go late both times (seat 4: picks 4 and 5) get a
  slightly weaker first pick but by far the best-informed, least-contested
  second pick, taken back-to-back. This shapes the archetype choice too: a
  seat forced into a weak second pick often has to pivot to wood-brick/
  expansion racing rather than complete an OWS engine, simply because the
  ore/wheat corners are gone by the time they act again.

### 2.8 Blocking

Consensus (multiple strategy write-ups; general community agreement) treats
blocking as a **second-order** decision, worth it only when the denial value
clearly exceeds your own opportunity cost:

- Worth it when the blocked spot is an opponent's clear best remaining option
  (e.g. their only path to complete an OWS engine, or their only remaining
  6/8) **and** your own best alternative spot is close in value to the one
  you'd be blocking with.
- Not worth it when you'd be giving up meaningfully more value than you deny
  — taking a mediocre spot "just to spite" an opponent who has other
  reasonable options left is a commonly cited beginner mistake.
- Most valuable in the **early-to-middle** part of the draft, since blocking
  someone's first settlement removes an entire future engine, whereas
  blocking a second settlement only removes one incremental spot.

## 3. Principles table

| ID | Principle | One-sentence coach version | Competitive justification | Source |
|---|---|---|---|---|
| P1 | Pip count floor | "Add up the dots on your hexes — aim for 10+, and treat 12-13+ as a great opening." | Pip count is the most consistently cited quick-evaluation metric across strategy sources; higher, more-spread pip totals correlate with more reliable early production in every independent write-up surveyed. | Everything Is A Game; King of Catan; BoardGameGeek strategy thread; Colonist.io |
| P2 | OWS engine | "If you can grab a strong ore+wheat corner, it funds cities and dev cards all game." | Ore+grain is the direct input to cities (2 VP, doubled production) and development cards; sources consistently name this the highest-ceiling engine when a good corner is available. | Colonist.io starting-strategies guide; Catan Universe community guides; BGG strategy thread |
| P3 | Wood-brick race | "No good ore/wheat spot left? Grab wood+brick and race to your 3rd settlement instead." | Lumber+brick chains roads fastest, contests Longest Road, and claims extra settlements before slower opponents — the standard fallback when the engine-building corners are already taken. | Colonist.io; multiple independent Medium/community strategy guides |
| P4 | Resource scarcity weighting | "A resource that's rare on this board is worth more than its pip count suggests — you can charge for it." | Scarce resources can't easily be bought from opponents, and holding one gives you trading leverage over everyone who lacks it; this is a repeated, mechanism-grounded claim across independent sources. | BoardGameGeek strategy thread; blog.colonist.io; board-game-analysis write-ups |
| P5 | Number/roll coverage (not just pip sum) | "Two different hot numbers (like 6 and 8) beat two of the same number (like 6 and 6) — one robber can't shut off both." | Same pip total, but stacking one number means a single robber placement (or a cold streak on that roll) can zero out both settlements at once, whereas different numbers can only ever be half-blocked. | Multiple independent strategy write-ups on the 6/6-vs-6/8 comparison |
| P6 | Port match (strong) | "A 2:1 port is only worth chasing if you already produce plenty of that resource to trade away." | A 2:1 port on a resource you already overproduce turns surplus into whatever you're missing, compounding for the rest of the game; sources treat this as the only real justification for prioritizing a port. | Colonist.io; Catan Universe community guides |
| P7 | Port trap | "Don't take a port spot just because it's a port — if it doesn't match your production, it's not helping you yet." | A port produces nothing by itself; taking a lower-production port vertex over a higher-production inland one, especially on a first settlement, is a commonly flagged beginner mistake. | Colonist.io; community strategy write-ups |
| P8 | Setup road direction | "Point your setup road at the best open spot you can still legally reach — not just toward the middle." | Since the distance rule blocks the road's own far endpoint from ever being settled, the road's entire value is which future settlement it sets up; roads toward the crowded center often reach nothing because everyone else is converging there too. | Catan Fandom "Free Settlement Strategy"; BGG discussion; community guides |
| P9 | Early-pick value maximization | "First settlement of the game? Take the best spot on the board — nobody's committed to anything yet." | With no opponent placements to react to, raw production/scarcity/diversity value is the only signal available, so early picks should simply maximize it. | Consensus across seat-position discussions (Colonist.io; community guides) |
| P10 | Late-pick reactive fill | "Second settlement? Look at what your first one is missing, and at what everyone else already grabbed." | By the time of a second placement, every opponent's first settlement and road are visible, so the pick should react — filling missing resource types/combos and weighing denial — rather than blindly re-maximizing raw pips. | Community consensus on snake-draft dynamics; diversityBonus/comboBonus design already reflects this |
| P11 | Blocking threshold | "Only take a spot to block someone if what you deny them is worth more than what you give up yourself." | Blocking is a second-order move: it's correct when the denied spot is an opponent's clear best remaining option and your own alternative is close in value, but a trap when it costs you meaningfully more than it costs them. | General community strategy consensus; BGG strategy thread |
| P12 | Type diversity floor | "Try to touch at least three different resources across your two settlements so no single drought stalls you." | The "get one of everything" baseline heuristic protects against being fully dependent on trades for basic building resources; widely repeated as the beginner-safe starting point before layering OWS/wood-brick specialization on top. | Everything Is A Game; Hexagamers strategy guide |

## 4. Coach phrasing

Ready-to-use sentence templates, each tied to a principle ID, for the coaching
agent (`coach.ts`) to emit. `{n}` placeholders are filled from the
`ScoreBreakdown`/`RoadCandidate` at hand.

1. **(P1)** "That's a {pips}-pip spot — {above/below} the 10-pip bar strong players look for on an opening settlement."
2. **(P2)** "Nice — this corner produces both ore and grain, so you're set up for a city-and-development-card engine straight away."
3. **(P3)** "The ore/wheat corners are gone, so leaning into wood and brick here to race for extra settlements is exactly the right pivot."
4. **(P4)** "{Resource} is scarce on this board — producing it gives you real trading leverage, not just raw pips."
5. **(P5)** "You've already got a 6 nearby — grabbing another 6 here doubles your risk instead of spreading it; a different hot number would cover more rolls."
6. **(P6)** "That 2:1 {resource} port is a real asset here because you're already producing plenty of {resource} to trade away."
7. **(P7)** "That port looks shiny, but you're barely producing the resource it trades — it won't help you until your production catches up, so the plain high-pip spot next to it is the stronger pick."
8. **(P8)** "Point this road at {target} — it's the best open spot you can still legally reach, not just the direction that feels central."
9. **(P8)** "This road heads toward water/a spot that's already blocked — swing it the other way toward {target} instead."
10. **(P9)** "This is the very first placement of the game — nobody's committed to anything yet, so just take the best spot on the board."
11. **(P10)** "You've seen everyone's first settlement now — this pick should fill what {your first spot} is missing, not just chase more raw pips."
12. **(P11)** "Blocking {opponent}'s dream spot here is worth it — what you deny them is worth more than the small edge you'd give up by not taking your own next-best option."

## 5. Mapping to engine

Engine reference: `tabletop-trainer/src/engine/catan/evaluate.ts` (`ScoreBreakdown`,
`WEIGHTS`) and `opponents.ts` (`chooseOpponentMove`, `roadCandidates`).

| ID | Principle | Engine component | Notes |
|---|---|---|---|
| P1 | Pip count floor | `pips` | Directly implemented: `vertexProduction` sums `PIPS[token]` per adjacent hex. |
| P2 | OWS engine | `comboBonus` / `combosCompleted` ("city engine (ore + grain)"), plus `weightedPips` if ore/grain happen to be the scarce resources | Direct match — the exact string `'city engine (ore + grain)'` is already in `evaluate.ts`. `WEIGHTS.combo = 0.9` per combo completed. |
| P3 | Wood-brick race | `comboBonus` / `combosCompleted` ("road engine (brick + lumber)") | Direct match, same mechanism as P2, `WEIGHTS.combo = 0.9`. |
| P4 | Resource scarcity weighting | `weightedPips` via `scarcityWeights()` | Direct match: `weight = clamp(boardAverage / thisResourceTotal, 0.7, 1.5)` — a scarce resource's pips count for up to 1.5x, an abundant one as little as 0.7x. This *is* the engine's implementation of P4. |
| P5 | Number/roll coverage | **Not represented.** | `pips`/`weightedPips` only sum dot values; nothing in `ScoreBreakdown` looks at whether a player's *existing* settlements already touch the same token number, so the engine currently can't distinguish a 6+8 spot from a 6+6 spot of equal pip sum, or penalize stacking a number the player already owns. **Flag for engine team**: would need a new component (e.g. `numberOverlapPenalty`) computed from the player's already-placed vertices' token sets vs. the candidate's token set. |
| P6 | Port match (strong) | `portBonus` (resource-kind branch) | Direct match: `portBonus = min(portResourceCap, portResourceBase + portResourcePerPip * afterProd[port.kind])` — the bonus is explicitly scaled by the player's own production of the matching resource, which is exactly P6's "only good if it matches production" rule. |
| P7 | Port trap | **Partially represented.** | The scaling above means a zero-production resource port still gets `portResourceBase = 0.5` as a floor, i.e. the engine gives *some* credit even with no matching production — it will never rate a resource port as actively *negative*, only as low relative to a matching-production alternative. This is a soft version of P7, not an explicit trap penalty; the coach can still explain it correctly today (bonus is small when production is 0), but there's no distinct "you're falling for the port trap" signal separate from just reading a low `portBonus`. Consider flagging in the coach when `portBonus` is near its floor **and** the vertex is a first settlement. |
| P8 | Setup road direction | `roadCandidates()` / `RoadCandidate.value` (built from `targetScore.total`, i.e. the full `ScoreBreakdown` of the best reachable future spot) | Direct match, though it lives outside `ScoreBreakdown` itself (it's a road-specific structure). `chooseOpponentRoad` and the coach's road grading both already consume this. Dead-end/water directions naturally score `value = 0` since `target` is `null`. |
| P9 | Early-pick value maximization | No dedicated component — this is a **context/weighting** rule, not a scoring component | The engine always ranks by the same `total`; "maximize raw value early" falls out naturally because there's nothing to react to yet, not because of a distinct weight. No gap, but worth noting for the coach's narrative layer (`puzzle.ts` already knows `placements.length` / whose pick this is and can frame the explanation accordingly). |
| P10 | Late-pick reactive fill | `diversityBonus` (new resource types) + `comboBonus` (completes an engine) | Direct match: both are computed relative to `owned` production (the player's *existing* placements), which is precisely "react to what your first settlement is missing." |
| P11 | Blocking threshold | Opponent-only today: `chooseOpponentMove`'s `'blocker'` branch (`value = s.total + 0.6 * userScores.get(vertex)`) | **Gap for the player-facing coach:** the blocker personality already quantifies "how much the human wanted this spot," but that signal is only used to drive opponent AI, not exposed as a `ScoreBreakdown` component the coach can cite when advising the *human* player to block an opponent. Consider adding an optional `blockValue` field (opponent's best score at this vertex) when scoring for blocking-aware advice. |
| P12 | Type diversity floor | `diversityBonus` / `newResources` | Direct match: `WEIGHTS.diversityPerNewResource = 1.1` per new resource type the placement adds beyond what the player already owns. |

**Summary of gaps to flag for the engine team:** P5 (number/roll coverage) is
not modeled at all today and is the clearest missing component — `pips` and
`weightedPips` are number-blind beyond their PIPS-table value. P7 (port trap)
and P11 (blocking, for the player's own decisions rather than just the
opponent AI) are only partially/indirectly representable with the current
`ScoreBreakdown` shape and would benefit from small, explicitly-named
additions rather than being inferred from existing fields.

## 6. Golden positions

Concrete board-state patterns the engine team can turn into regression tests.
Each assumes a legal, otherwise-normal 4-player standard board.

### G1 — "12-pip OWS corner available"

**Setup:** An open vertex touches a `6-ore`, `5-grain`, and `9-wool` hex (5+4+2
= 11 pips, plus it also happens to sit one road away from a 2:1 ore port whose
match is genuine given the 6-ore hex). This is the player's **first**
placement (pick 1-4 of 8); no opponent has placed yet.

- **Known-best move:** take the OWS corner. It clears the P1 pip floor (11,
  close to the 12-13 pro target), completes the P2 ore+grain combo the moment
  the second settlement adds any grain/ore, and the nearby 2:1 ore port is a
  genuine P6 match given the 6-ore hex, not a P7 trap.
- **Known-bad move:** taking a nearby 10-pip wood-brick corner "to be safe" on
  road access, when nothing yet threatens the OWS corner (no opponents have
  placed) — this discards higher expected value with zero information
  justifying the more conservative choice. It's specifically bad *here*
  because it's an early pick (P9): there's nothing to react to yet, so raw
  value should win.

### G2 — "2:1 port trap on a first settlement"

**Setup:** A coastal vertex offers a 2:1 wool port but only touches one wool
hex on a `3` token (2 pips) plus two unrelated low-value hexes (total 6-7
pips). An inland vertex two spaces away offers 11 pips across brick/grain/ore
with no port. This is a **first** placement.

- **Known-best move:** take the inland 11-pip vertex. The port vertex fails
  P1 (below the 10-pip floor) and is a textbook P7 trap — a 2:1 wool port is
  nearly worthless when the settlement barely produces wool to trade away.
- **Known-bad move:** taking the port vertex "because ports are valuable."
  The engine's own `portBonus` for this vertex should come out low (near the
  `portResourceBase` floor, since `afterProd.wool` is only 2), while the
  inland vertex's `weightedPips` clearly dominates — this is the exact,
  explainable gap the coach should surface (P7).

### G3 — "Redundant number vs. blocking opportunity" (second placement)

**Setup:** It's the player's **second** placement (pick 5-8 of 8; all four
seats have placed once, one opponent has placed twice). The player's first
settlement already touches a `6`. Two legal vertices remain close in value:
(a) a vertex adding another `6` and an `8` (pips look great in isolation, but
the `6` duplicates the player's existing number) and (b) a vertex adding a
`5`, a `9`, and a new resource type the player doesn't have yet, which is
also the single best remaining spot for a specific opponent's OWS engine (an
opponent's setup road already points directly at it).

- **Known-best move:** vertex (b). It satisfies P10 (reacts to what the first
  settlement is missing, likely completing/advancing a combo via
  `comboBonus`/`diversityBonus`), respects P5 (adds a *new* hot number, 9,
  rather than doubling down on the already-owned 6, improving roll coverage
  and robber resilience), and doubles as a P11 block — denying the
  opponent's clearly-telegraphed best remaining spot at little-to-no cost to
  the player's own value, since (a) and (b) were close in raw score anyway.
- **Known-bad move:** vertex (a). Despite a tempting on-paper pip total, it
  stacks a second settlement onto the number the player already owns (a
  single robber placement can now shut off both of the player's settlements
  at once — the P5 mistake), fails to add a new resource type the way (b)
  does (weaker on P10/P12), and leaves the opponent's dream OWS corner
  completely open (a missed, low-cost P11 block).
