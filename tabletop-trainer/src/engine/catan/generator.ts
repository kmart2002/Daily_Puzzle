import { rngFromSeed, shuffled, Rng } from '../rng';
import {
  allHexCoords, boardVertexKeys, coastRing, hexNeighbors, inBoard,
} from './board';
import { Board, Hex, Port, Resource, TileType } from './types';

/** Standard base-game tile pool: 4 lumber, 4 wool, 4 grain, 3 brick, 3 ore, 1 desert. */
const TILE_POOL: readonly TileType[] = [
  'lumber', 'lumber', 'lumber', 'lumber',
  'wool', 'wool', 'wool', 'wool',
  'grain', 'grain', 'grain', 'grain',
  'brick', 'brick', 'brick',
  'ore', 'ore', 'ore',
  'desert',
];

/** Standard number tokens (no 7). */
const TOKEN_POOL: readonly number[] = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

/** Standard port pool: 4 generic 3:1 + one 2:1 per resource. */
const PORT_POOL: readonly (Resource | 'any')[] = [
  'any', 'any', 'any', 'any', 'brick', 'lumber', 'ore', 'grain', 'wool',
];

/** Official setup rule: red tokens (6 and 8) may not sit on adjacent hexes. */
export function redTokensLegal(hexes: Hex[]): boolean {
  const byCoord = new Map(hexes.map((h) => [`${h.q},${h.r}`, h]));
  for (const h of hexes) {
    if (h.token !== 6 && h.token !== 8) continue;
    for (const n of hexNeighbors(h.q, h.r)) {
      const other = byCoord.get(`${n.q},${n.r}`);
      if (other && (other.token === 6 || other.token === 8)) return false;
    }
  }
  return true;
}

function rollHexes(rnd: Rng): Hex[] {
  const coords = allHexCoords();
  const tiles = shuffled(TILE_POOL, rnd);
  const tokens = shuffled(TOKEN_POOL, rnd);
  let t = 0;
  return coords.map(({ q, r }, i) => ({
    q,
    r,
    tile: tiles[i],
    token: tiles[i] === 'desert' ? null : tokens[t++],
  }));
}

/**
 * Ports sit on the 30-vertex coast ring: 9 ports × 2 vertices with the standard
 * 1-1-2 gap rhythm between them (9·2 + 3·(1+1+2) = 30, so it wraps exactly).
 */
function rollPorts(rnd: Rng): Port[] {
  const ring = coastRing();
  const kinds = shuffled(PORT_POOL, rnd);
  const gaps = [1, 1, 2];
  const ports: Port[] = [];
  let i = 0;
  for (let p = 0; p < 9; p++) {
    ports.push({ vertices: [ring[i % 30], ring[(i + 1) % 30]], kind: kinds[p] });
    i += 2 + gaps[p % 3];
  }
  return ports;
}

/**
 * Generate a full board from a seed string. Rejection-samples token layouts
 * until the 6/8 adjacency rule holds (a fresh shuffle each attempt keeps the
 * distribution unbiased enough for puzzles).
 */
export function generateBoard(seed: string): Board {
  const rnd = rngFromSeed(`board:${seed}`);
  let hexes = rollHexes(rnd);
  for (let attempt = 0; attempt < 1000 && !redTokensLegal(hexes); attempt++) {
    hexes = rollHexes(rnd);
  }
  return {
    seed,
    hexes,
    vertexKeys: boardVertexKeys(),
    ports: rollPorts(rnd),
  };
}

export function hexAt(board: Board, q: number, r: number): Hex | undefined {
  if (!inBoard(q, r)) return undefined;
  return board.hexes.find((h) => h.q === q && h.r === r);
}
