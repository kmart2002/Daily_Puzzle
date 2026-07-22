import { EdgeKey } from './board';
import { Rng } from '../rng';
import { rankVertices, roadCandidates, ScoreBreakdown } from './evaluate';
import { Board, Placement, Road, VertexKey } from './types';

export type Personality = 'greedy' | 'balanced' | 'blocker';

export interface OpponentProfile {
  name: string;
  personality: Personality;
  tagline: string;
}

export const OPPONENT_PROFILES: Record<Personality, OpponentProfile> = {
  greedy: {
    name: 'Greedy Gretel',
    personality: 'greedy',
    tagline: 'Takes the most pips, no questions asked',
  },
  balanced: {
    name: 'Balanced Boris',
    personality: 'balanced',
    tagline: 'Weighs production, diversity, ports and expansion',
  },
  blocker: {
    name: 'Blocker Bianca',
    personality: 'blocker',
    tagline: 'Happy to take a spot just because you wanted it',
  },
};

/**
 * Pick a settlement for an opponent. All personalities reuse the shared
 * explainable evaluator with different weightings; the blocker also values a
 * vertex by how much the human wanted it. Tie-breaks use the seeded RNG only,
 * so a session seed fully determines opponent play.
 */
export function chooseOpponentMove(
  board: Board,
  placements: Placement[],
  player: number,
  personality: Personality,
  rnd: Rng,
  userSeat: number,
): VertexKey {
  const ranked = rankVertices(board, placements, player);
  if (ranked.length === 0) throw new Error('no legal vertices left');

  const jitter = () => rnd() * 0.001;
  let scored: { vertex: VertexKey; value: number }[];

  switch (personality) {
    case 'greedy':
      scored = ranked.map((s) => ({ vertex: s.vertex, value: s.pips * 10 + s.total + jitter() }));
      break;
    case 'balanced':
      scored = ranked.map((s) => ({ vertex: s.vertex, value: s.total + jitter() }));
      break;
    case 'blocker': {
      const userScores = new Map(
        rankVertices(board, placements, userSeat).map((s) => [s.vertex, s.total]),
      );
      scored = ranked
        .slice(0, 8)
        .map((s) => ({
          vertex: s.vertex,
          value: s.total + 0.6 * (userScores.get(s.vertex) ?? 0) + jitter(),
        }));
      break;
    }
  }

  scored.sort((a, b) => b.value - a.value || a.vertex.localeCompare(b.vertex));
  return scored[0].vertex;
}

/**
 * Pick the setup road for the settlement an opponent just placed: the edge
 * pointing at the most valuable still-open expansion spot. All personalities
 * share this; road style differences are a phase-2 refinement.
 */
export function chooseOpponentRoad(
  board: Board,
  placements: Placement[],
  roads: Road[],
  player: number,
  settlementVertex: VertexKey,
  rnd: Rng,
): EdgeKey {
  const candidates = roadCandidates(board, placements, roads, player, settlementVertex);
  if (candidates.length === 0) throw new Error('no legal setup road');
  const scored = candidates.map((c) => ({ edge: c.edge, value: c.value + rnd() * 0.001 }));
  scored.sort((a, b) => b.value - a.value || a.edge.localeCompare(b.edge));
  return scored[0].edge;
}

/** Exposed for tests/UI: what the opponent was choosing between. */
export function opponentCandidates(
  board: Board,
  placements: Placement[],
  player: number,
): ScoreBreakdown[] {
  return rankVertices(board, placements, player).slice(0, 5);
}
