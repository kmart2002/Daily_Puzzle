import {
  EdgeKey, edgeEndpoints, parseVertexKey, touchingHexes, vertexKey, vertexNeighbors,
} from './board';
import { hexAt } from './generator';
import { isLegal, legalSetupRoads, legalVertices } from './rules';
import {
  Board, PIPS, Placement, Port, Resource, RESOURCES, Road, VertexKey,
} from './types';

/** Tunable weights — change here only (see /tune-heuristics skill). */
export const WEIGHTS = {
  diversityPerNewResource: 1.1,
  combo: 0.9,
  portGeneric: 0.8,
  portResourceBase: 0.5,
  portResourcePerPip: 0.3,
  portResourceCap: 2.5,
  expansionPerSpot: 0.12,
  expansionCap: 1.0,
  scarcityMin: 0.7,
  scarcityMax: 1.5,
} as const;

export type Production = Partial<Record<Resource, number>>;

/**
 * Explainable score: the coach turns each component into a sentence, so this
 * must stay a breakdown — never collapse it into an opaque number.
 */
export interface ScoreBreakdown {
  vertex: VertexKey;
  production: Production;
  /** Raw production: sum of pips of adjacent number tokens. */
  pips: number;
  /** Pips weighted by board-wide scarcity of each resource. */
  weightedPips: number;
  /** Resource types this placement adds that the player didn't have. */
  newResources: Resource[];
  diversityBonus: number;
  /** Completing brick+lumber (roads) or ore+grain (cities/dev cards). */
  comboBonus: number;
  combosCompleted: string[];
  port: Port | null;
  portBonus: number;
  /** How many nearby spots stay open to expand toward. */
  expansionSpots: number;
  expansionBonus: number;
  total: number;
}

/** Pips per resource produced at a vertex. */
export function vertexProduction(board: Board, vertex: VertexKey): Production {
  const prod: Production = {};
  for (const { q, r } of touchingHexes(parseVertexKey(vertex))) {
    const hex = hexAt(board, q, r);
    if (!hex || hex.tile === 'desert' || hex.token === null) continue;
    prod[hex.tile] = (prod[hex.tile] ?? 0) + PIPS[hex.token];
  }
  return prod;
}

/** Total pips available per resource across the whole board. */
export function boardResourcePips(board: Board): Record<Resource, number> {
  const totals = Object.fromEntries(RESOURCES.map((r) => [r, 0])) as Record<Resource, number>;
  for (const hex of board.hexes) {
    if (hex.tile === 'desert' || hex.token === null) continue;
    totals[hex.tile] += PIPS[hex.token];
  }
  return totals;
}

/**
 * Scarcity weight per resource: pips of a scarce resource are worth more.
 * weight = boardAverage / thisResourceTotal, clamped.
 */
export function scarcityWeights(board: Board): Record<Resource, number> {
  const totals = boardResourcePips(board);
  const avg = RESOURCES.reduce((s, r) => s + totals[r], 0) / RESOURCES.length;
  const clamp = (x: number) => Math.min(WEIGHTS.scarcityMax, Math.max(WEIGHTS.scarcityMin, x));
  return Object.fromEntries(
    RESOURCES.map((r) => [r, totals[r] === 0 ? WEIGHTS.scarcityMax : clamp(avg / totals[r])]),
  ) as Record<Resource, number>;
}

/** Pips per resource across all of a player's settlements. */
export function playerProduction(board: Board, placements: Placement[], player: number): Production {
  const prod: Production = {};
  for (const p of placements) {
    if (p.player !== player) continue;
    const vp = vertexProduction(board, p.vertex);
    for (const r of RESOURCES) {
      if (vp[r]) prod[r] = (prod[r] ?? 0) + vp[r]!;
    }
  }
  return prod;
}

export function portAt(board: Board, vertex: VertexKey): Port | null {
  return board.ports.find((p) => p.vertices.includes(vertex)) ?? null;
}

/** Open vertices exactly two roads away that would remain legal after placing here. */
function expansionSpots(board: Board, placements: Placement[], vertex: VertexKey): number {
  const after: Placement[] = [...placements, { player: -1, vertex }];
  const v = parseVertexKey(vertex);
  const nearby = new Set<VertexKey>();
  for (const n of vertexNeighbors(v)) {
    for (const nn of vertexNeighbors(n)) {
      const key = vertexKey(nn);
      if (key !== vertex) nearby.add(key);
    }
  }
  let count = 0;
  for (const key of nearby) {
    if (isLegal(board, after, key)) count++;
  }
  return count;
}

export function scoreVertex(
  board: Board,
  placements: Placement[],
  player: number,
  vertex: VertexKey,
): ScoreBreakdown {
  const production = vertexProduction(board, vertex);
  const weights = scarcityWeights(board);
  const owned = playerProduction(board, placements, player);

  let pips = 0;
  let weightedPips = 0;
  for (const r of RESOURCES) {
    const p = production[r] ?? 0;
    pips += p;
    weightedPips += p * weights[r];
  }

  const newResources = RESOURCES.filter((r) => (production[r] ?? 0) > 0 && !(owned[r] ?? 0));
  const diversityBonus = WEIGHTS.diversityPerNewResource * newResources.length;

  const has = (prod: Production, r: Resource) => (prod[r] ?? 0) > 0;
  const afterProd: Production = { ...owned };
  for (const r of RESOURCES) {
    if (production[r]) afterProd[r] = (afterProd[r] ?? 0) + production[r]!;
  }
  const combosCompleted: string[] = [];
  for (const [a, b, label] of [
    ['brick', 'lumber', 'road engine (brick + lumber)'],
    ['ore', 'grain', 'city engine (ore + grain)'],
  ] as const) {
    if (has(afterProd, a) && has(afterProd, b) && !(has(owned, a) && has(owned, b))) {
      combosCompleted.push(label);
    }
  }
  const comboBonus = WEIGHTS.combo * combosCompleted.length;

  const port = portAt(board, vertex);
  let portBonus = 0;
  if (port) {
    portBonus =
      port.kind === 'any'
        ? WEIGHTS.portGeneric
        : Math.min(
            WEIGHTS.portResourceCap,
            WEIGHTS.portResourceBase + WEIGHTS.portResourcePerPip * (afterProd[port.kind] ?? 0),
          );
  }

  const spots = expansionSpots(board, placements, vertex);
  const expansionBonus = Math.min(WEIGHTS.expansionCap, WEIGHTS.expansionPerSpot * spots);

  const total = weightedPips + diversityBonus + comboBonus + portBonus + expansionBonus;

  return {
    vertex,
    production,
    pips,
    weightedPips,
    newResources,
    diversityBonus,
    comboBonus,
    combosCompleted,
    port,
    portBonus,
    expansionSpots: spots,
    expansionBonus,
    total,
  };
}

/** All legal vertices scored for `player`, best first. Deterministic tiebreak. */
export function rankVertices(
  board: Board,
  placements: Placement[],
  player: number,
): ScoreBreakdown[] {
  return legalVertices(board, placements)
    .map((v) => scoreVertex(board, placements, player, v))
    .sort((a, b) => b.total - a.total || a.vertex.localeCompare(b.vertex));
}

/**
 * A candidate setup road from a settlement. Since the distance rule forbids
 * settling the road's far endpoint, a setup road is about direction: its value
 * is the best future settlement spot it moves you one road closer to
 * (vertices adjacent to the far endpoint that are currently legal).
 */
export interface RoadCandidate {
  edge: EdgeKey;
  /** The endpoint away from the settlement. */
  toward: VertexKey;
  /** Best future spot this road points at (null if it points at nothing). */
  target: VertexKey | null;
  targetScore: ScoreBreakdown | null;
  value: number;
}

export function roadCandidates(
  board: Board,
  placements: Placement[],
  roads: Road[],
  player: number,
  settlementVertex: VertexKey,
): RoadCandidate[] {
  return legalSetupRoads(roads, settlementVertex)
    .map((edge) => {
      const [a, b] = edgeEndpoints(edge);
      const toward = a === settlementVertex ? b : a;
      let target: VertexKey | null = null;
      let targetScore: ScoreBreakdown | null = null;
      for (const n of vertexNeighbors(parseVertexKey(toward))) {
        const key = vertexKey(n);
        if (key === settlementVertex || !isLegal(board, placements, key)) continue;
        const s = scoreVertex(board, placements, player, key);
        if (!targetScore || s.total > targetScore.total) {
          target = key;
          targetScore = s;
        }
      }
      return { edge, toward, target, targetScore, value: targetScore?.total ?? 0 };
    })
    .sort((a, b) => b.value - a.value || a.edge.localeCompare(b.edge));
}

/** Human-readable description of a vertex, e.g. "6 grain / 9 ore / 11 wool". */
export function describeVertex(board: Board, vertex: VertexKey): string {
  const parts: string[] = [];
  for (const { q, r } of touchingHexes(parseVertexKey(vertex))) {
    const hex = hexAt(board, q, r);
    if (!hex) continue;
    if (hex.tile === 'desert') parts.push('desert');
    else parts.push(`${hex.token} ${hex.tile}`);
  }
  const port = portAt(board, vertex);
  const portLabel = port ? (port.kind === 'any' ? ' (3:1 port)' : ` (2:1 ${port.kind} port)`) : '';
  return (parts.length ? parts.join(' / ') : 'open water') + portLabel;
}
