import { EdgeKey } from './board';
import {
  describeVertex, rankVertices, roadCandidates, RoadCandidate, scoreVertex, ScoreBreakdown,
} from './evaluate';
import { Board, Placement, Resource, Road, VertexKey } from './types';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface CoachReport {
  /** 1-based puzzle step (1st or 2nd settlement). */
  step: number;
  player: number;
  chosen: ScoreBreakdown;
  best: ScoreBreakdown;
  /** 1-based rank of the chosen vertex among all legal options. */
  rank: number;
  outOf: number;
  grade: Grade;
  headline: string;
  details: string[];
  /** Top alternatives (excluding the chosen spot). */
  alternatives: ScoreBreakdown[];
  /** The top-3 spots at decision time, in rank order — includes the chosen
   *  spot when it made the cut, so the UI can show "the podium" regardless
   *  of what the player picked. */
  topPicks: ScoreBreakdown[];
}

function gradeFor(rank: number, gap: number): Grade {
  if (rank === 1) return 'S';
  if (gap < 0.7) return 'A';
  if (gap < 1.8) return 'B';
  if (gap < 3.2) return 'C';
  return 'D';
}

const HEADLINES: Record<Grade, string> = {
  S: 'Perfect — that is the best spot on the board.',
  A: 'Strong pick — within a hair of the best spot.',
  B: 'Decent, but you left value on the table.',
  C: 'Shaky — a clearly stronger spot was available.',
  D: 'Ouch — this one will hurt all game.',
};

function listResources(rs: Resource[]): string {
  return rs.join(', ');
}

function prodSummary(s: ScoreBreakdown): string {
  const parts = Object.entries(s.production).map(([r, p]) => `${r} ${p}`);
  return parts.length ? `${s.pips} pips (${parts.join(', ')})` : 'no production at all';
}

/**
 * Grade a placement the player just chose. `placementsBefore` is the state at
 * decision time — the ranking the player was actually choosing from.
 */
export function coachPlacement(
  board: Board,
  placementsBefore: Placement[],
  player: number,
  chosenVertex: VertexKey,
  step: number,
): CoachReport {
  const ranked = rankVertices(board, placementsBefore, player);
  const chosen =
    ranked.find((s) => s.vertex === chosenVertex) ??
    scoreVertex(board, placementsBefore, player, chosenVertex);
  const best = ranked[0];
  const rank = Math.max(1, ranked.findIndex((s) => s.vertex === chosenVertex) + 1);
  const gap = best.total - chosen.total;
  const grade = gradeFor(rank, gap);

  // Coaching language follows the competitive-play spec in
  // docs/specs/catan-opening.md (principle ids P1-P12 referenced below).
  const details: string[] = [];
  details.push(`You took ${describeVertex(board, chosenVertex)} — ${prodSummary(chosen)}.`);

  // P1: pip bands pros use — ~9 weak, 10-11 solid, 12-13+ strong.
  if (step === 1) {
    if (chosen.pips >= 12) {
      details.push(
        `${chosen.pips} pips clears the 12-13 bar competitive players treat as a premium opening.`,
      );
    } else if (chosen.pips >= 10) {
      details.push(`${chosen.pips} pips clears the 10-pip bar strong players want from an opener.`);
    } else {
      details.push(
        `${chosen.pips} pips is below the 10-pip bar strong players look for in an opening settlement — you'd be relying on lucky dice to keep up.`,
      );
    }
  }

  if (rank === 1) {
    if (ranked[1]) {
      details.push(
        `Runner-up was ${describeVertex(board, ranked[1].vertex)}, ` +
          `worth ${(chosen.total - ranked[1].total).toFixed(1)} points less.`,
      );
    }
  } else {
    details.push(
      `The top spot was ${describeVertex(board, best.vertex)} — ${prodSummary(best)}. ` +
        `Your pick ranked #${rank} of ${ranked.length}, giving up ${gap.toFixed(1)} points.`,
    );
    if (best.pips > chosen.pips + 1) {
      details.push(`That is ${best.pips - chosen.pips} fewer pips of production every rotation.`);
    }
  }

  const missing = best.newResources.filter((r) => !chosen.newResources.includes(r));
  if (rank !== 1 && missing.length > 0) {
    details.push(
      `It also misses ${listResources(missing)}, which the top spot would have added to your economy.`,
    );
  }
  if (chosen.newResources.length >= 3) {
    details.push(`Nice diversity — ${listResources(chosen.newResources)} are all new for you.`);
  } else if (step === 2 && chosen.newResources.length === 0) {
    details.push('This doubles down on resources you already had — second placements usually want to fill gaps.');
  }

  // P2/P3: the two classic archetypes and why pros pick them.
  for (const combo of chosen.combosCompleted) {
    details.push(
      combo.startsWith('city')
        ? 'It sets up the ore + grain engine — the city-and-development-card plan competitive players rate as the highest-ceiling opening when a good corner offers it.'
        : 'It sets up the brick + lumber engine — the road-race plan pros pivot to for grabbing extra settlements when the ore/wheat corners are taken.',
    );
  }
  if (chosen.combosCompleted.length === 0 && rank !== 1 && best.combosCompleted.length > 0) {
    details.push(
      `The top spot would have completed the ${best.combosCompleted.join(' and ')} — an engine, not just pips.`,
    );
  }

  // P5: roll coverage — stacking an owned number is robber bait.
  if (chosen.duplicatedNumbers.length > 0) {
    const nums = chosen.duplicatedNumbers.join(' and ');
    details.push(
      `You already collect on ${nums}; doubling up means a single robber can freeze both settlements at once. Pros pay a premium for a different number with the same pips — it covers more rolls.`,
    );
  }

  // P6/P7: a port is only as good as the production behind it.
  if (chosen.port) {
    const kind = chosen.port.kind;
    if (kind === 'any') {
      details.push('The 3:1 port adds trade flexibility once your production is rolling.');
    } else {
      const backing = chosen.production[kind] ?? 0;
      details.push(
        chosen.portBonus > 1.2
          ? `The 2:1 ${kind} port is backed by real ${kind} production — surplus becomes whatever you're missing, the only port play pros respect.`
          : `Careful: that 2:1 ${kind} port looks shiny, but with ${backing} ${kind} pip${backing === 1 ? '' : 's'} behind it, it's the classic first-pick port trap — a port produces nothing by itself.`,
      );
    }
  }

  // P4: scarcity is trading leverage, not just pips.
  if (chosen.weightedPips < chosen.pips * 0.92) {
    details.push(
      'This production leans on resources that are plentiful this board — everyone will have them, so each pip trades below face value.',
    );
  } else if (chosen.weightedPips > chosen.pips * 1.08 && chosen.pips > 0) {
    details.push(
      'Good scarcity play — these resources are rare on this board, so beyond the pips you gain real trading leverage over everyone who lacks them.',
    );
  }

  // P11: a block is free when the spot was also an opponent's best option.
  const NUM_PLAYERS = 4;
  for (let p = 0; p < NUM_PLAYERS; p++) {
    if (p === player) continue;
    const theirBest = rankVertices(board, placementsBefore, p)[0];
    if (theirBest && theirBest.vertex === chosenVertex) {
      details.push(
        'Bonus: this was also an opponent’s best remaining spot — a free block, which is exactly when pros say denying is worth it.',
      );
      break;
    }
  }

  if (rank !== 1 && best.expansionSpots > chosen.expansionSpots + 3) {
    details.push('You are also more boxed in — fewer open spots nearby to expand toward later.');
  }

  return {
    step,
    player,
    chosen,
    best,
    rank,
    outOf: ranked.length,
    grade,
    headline: HEADLINES[grade],
    details,
    alternatives: ranked.filter((s) => s.vertex !== chosenVertex).slice(0, 3),
    topPicks: ranked.slice(0, 3),
  };
}

export interface RoadReport {
  step: number;
  player: number;
  chosen: RoadCandidate;
  best: RoadCandidate;
  rank: number;
  outOf: number;
  grade: Grade;
  headline: string;
  details: string[];
  /** All road directions at decision time, in rank order (max 3). */
  topPicks: RoadCandidate[];
}

function roadGrade(rank: number, gap: number): Grade {
  if (rank === 1) return 'S';
  if (gap < 0.5) return 'A';
  if (gap < 1.5) return 'B';
  if (gap < 3) return 'C';
  return 'D';
}

const ROAD_HEADLINES: Record<Grade, string> = {
  S: 'Best road available — pointed straight at your next spot.',
  A: 'Fine road — the directions were nearly equal.',
  B: 'Playable, but another direction promised more.',
  C: 'Aimed at thin territory while a rich direction was open.',
  D: 'This road points at nothing you can ever build on.',
};

/**
 * Grade the setup road placed with a settlement. `placements`/`roads` are the
 * state at decision time (the settlement itself is already in `placements`).
 */
export function coachRoad(
  board: Board,
  placements: Placement[],
  roads: Road[],
  player: number,
  settlementVertex: VertexKey,
  chosenEdge: EdgeKey,
  step: number,
): RoadReport {
  const candidates = roadCandidates(board, placements, roads, player, settlementVertex);
  const chosen = candidates.find((c) => c.edge === chosenEdge) ?? candidates[0];
  const best = candidates[0];
  const rank = Math.max(1, candidates.findIndex((c) => c.edge === chosenEdge) + 1);
  const gap = best.value - chosen.value;
  const grade = roadGrade(rank, gap);

  const details: string[] = [];
  if (chosen.target && chosen.targetScore) {
    details.push(
      `Your road points toward ${describeVertex(board, chosen.target)} ` +
        `(worth ${chosen.targetScore.total.toFixed(1)} as a future settlement).`,
    );
  } else {
    details.push('Your road points toward a dead end — every spot beyond it is blocked.');
  }
  if (rank !== 1 && best.target) {
    details.push(
      `The best road aimed at ${describeVertex(board, best.target)} ` +
        `(worth ${best.value.toFixed(1)}), ${gap.toFixed(1)} points more expansion value. ` +
        'Pros aim setup roads at the best spot they can still legally reach — not at the crowded middle, where everyone else is racing too.',
    );
  }
  if (rank === 1 && candidates.length > 1) {
    details.push(
      'You read the map correctly — no direction offered a better reachable spot, which is exactly how competitive players pick setup roads.',
    );
  }

  return {
    step, player, chosen, best, rank, outOf: candidates.length, grade,
    headline: ROAD_HEADLINES[grade], details, topPicks: candidates,
  };
}

/** Top-n suggestions with one-line reasons — powers the hint button. */
export function hints(
  board: Board,
  placements: Placement[],
  player: number,
  n = 3,
): { spot: ScoreBreakdown; reason: string }[] {
  return rankVertices(board, placements, player)
    .slice(0, n)
    .map((spot) => {
      const bits: string[] = [`${spot.pips} pips`];
      if (spot.newResources.length) bits.push(`adds ${listResources(spot.newResources)}`);
      if (spot.combosCompleted.length) bits.push(`completes ${spot.combosCompleted.join(', ')}`);
      if (spot.port) bits.push(spot.port.kind === 'any' ? '3:1 port' : `2:1 ${spot.port.kind} port`);
      return { spot, reason: bits.join(' · ') };
    });
}
