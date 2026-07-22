import {
  describeVertex, rankVertices, scoreVertex, ScoreBreakdown,
} from './evaluate';
import { Board, Placement, Resource, VertexKey } from './types';

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

  const details: string[] = [];
  details.push(`You took ${describeVertex(board, chosenVertex)} — ${prodSummary(chosen)}.`);

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

  if (chosen.combosCompleted.length > 0) {
    details.push(`It completes your ${chosen.combosCompleted.join(' and ')}.`);
  } else if (rank !== 1 && best.combosCompleted.length > 0) {
    details.push(`The top spot would have completed a ${best.combosCompleted.join(' and ')}.`);
  }

  if (chosen.port) {
    const kind = chosen.port.kind;
    details.push(
      kind === 'any'
        ? 'The 3:1 port gives you trade flexibility.'
        : `The 2:1 ${kind} port pairs with your ${kind} production — a real trading engine.`,
    );
  }

  if (chosen.weightedPips < chosen.pips * 0.92) {
    details.push(
      'Careful: this production leans on resources that are plentiful this board, so each pip trades below face value.',
    );
  } else if (chosen.weightedPips > chosen.pips * 1.08 && chosen.pips > 0) {
    details.push('Good scarcity play — these resources are rare on this board, so your pips are worth extra.');
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
