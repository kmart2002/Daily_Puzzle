import { VertexId, VertexKey } from './types';

/** Standard Catan base board: hexagon of radius 2 → 19 hexes. */
export const BOARD_RADIUS = 2;

export function inBoard(q: number, r: number): boolean {
  return (
    Math.abs(q) <= BOARD_RADIUS &&
    Math.abs(r) <= BOARD_RADIUS &&
    Math.abs(q + r) <= BOARD_RADIUS
  );
}

export function allHexCoords(): { q: number; r: number }[] {
  const out: { q: number; r: number }[] = [];
  for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++) {
    for (let r = -BOARD_RADIUS; r <= BOARD_RADIUS; r++) {
      if (inBoard(q, r)) out.push({ q, r });
    }
  }
  return out;
}

const HEX_DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
] as const;

export function hexNeighbors(q: number, r: number): { q: number; r: number }[] {
  return HEX_DIRS.map(([dq, dr]) => ({ q: q + dq, r: r + dr }));
}

export function vertexKey(v: VertexId): VertexKey {
  return `${v.q},${v.r},${v.side}`;
}

export function parseVertexKey(key: VertexKey): VertexId {
  const [q, r, side] = key.split(',');
  return { q: Number(q), r: Number(r), side: side as 'N' | 'S' };
}

/** The 6 corners of hex (q,r), clockwise from the top. */
export function hexCorners(q: number, r: number): VertexId[] {
  return [
    { q, r, side: 'N' },              // top
    { q: q + 1, r: r - 1, side: 'S' }, // upper-right
    { q, r: r + 1, side: 'N' },        // lower-right
    { q, r, side: 'S' },               // bottom
    { q: q - 1, r: r + 1, side: 'N' }, // lower-left
    { q, r: r - 1, side: 'S' },        // upper-left
  ];
}

/** The (up to 3) hex coordinates touching a vertex; some may be off-board. */
export function touchingHexes(v: VertexId): { q: number; r: number }[] {
  return v.side === 'N'
    ? [
        { q: v.q, r: v.r },
        { q: v.q, r: v.r - 1 },
        { q: v.q + 1, r: v.r - 1 },
      ]
    : [
        { q: v.q, r: v.r },
        { q: v.q, r: v.r + 1 },
        { q: v.q - 1, r: v.r + 1 },
      ];
}

/** The 3 vertices one road-edge away (some may be off-board). */
export function vertexNeighbors(v: VertexId): VertexId[] {
  return v.side === 'N'
    ? [
        { q: v.q, r: v.r - 1, side: 'S' },
        { q: v.q + 1, r: v.r - 1, side: 'S' },
        { q: v.q + 1, r: v.r - 2, side: 'S' },
      ]
    : [
        { q: v.q, r: v.r + 1, side: 'N' },
        { q: v.q - 1, r: v.r + 1, side: 'N' },
        { q: v.q - 1, r: v.r + 2, side: 'N' },
      ];
}

/** All 54 buildable vertices of the board, sorted for determinism. */
export function boardVertexKeys(): VertexKey[] {
  const set = new Set<VertexKey>();
  for (const { q, r } of allHexCoords()) {
    for (const c of hexCorners(q, r)) set.add(vertexKey(c));
  }
  return [...set].sort();
}

/** A vertex is on the coast if at least one of its touching hexes is off-board. */
export function isCoastal(v: VertexId): boolean {
  return touchingHexes(v).some(({ q, r }) => !inBoard(q, r));
}

/**
 * The 30 coastal vertices in ring order (each coastal vertex has exactly two
 * coastal edge-neighbors on a convex board, so the walk is well-defined).
 * Deterministic: starts from the lexicographically smallest coastal vertex.
 */
export function coastRing(): VertexKey[] {
  const coast = new Set(boardVertexKeys().filter((k) => isCoastal(parseVertexKey(k))));
  const start = [...coast].sort()[0];
  const ring: VertexKey[] = [start];
  let prev: VertexKey | null = null;
  let current = start;
  while (true) {
    const nexts = vertexNeighbors(parseVertexKey(current))
      .map(vertexKey)
      .filter((k) => coast.has(k) && k !== prev)
      .sort();
    const next = nexts[0];
    if (next === start) break;
    ring.push(next);
    prev = current;
    current = next;
  }
  return ring;
}

// --- Edges (roads) ---

/** Canonical edge id: the two endpoint vertex keys, sorted, joined by "|". */
export type EdgeKey = string;

export function edgeKey(a: VertexKey, b: VertexKey): EdgeKey {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function edgeEndpoints(edge: EdgeKey): [VertexKey, VertexKey] {
  const [a, b] = edge.split('|');
  return [a, b];
}

/** Edges from a vertex to its on-board neighbors. */
export function vertexEdges(v: VertexId): EdgeKey[] {
  const boardSet = new Set(boardVertexKeys());
  const key = vertexKey(v);
  if (!boardSet.has(key)) return [];
  return vertexNeighbors(v)
    .map(vertexKey)
    .filter((n) => boardSet.has(n))
    .map((n) => edgeKey(key, n));
}

// --- Geometry (shared by engine and UI so they can never disagree) ---

export function hexCenter(q: number, r: number, size: number): { x: number; y: number } {
  return { x: size * Math.sqrt(3) * (q + r / 2), y: size * 1.5 * r };
}

export function vertexPos(v: VertexId, size: number): { x: number; y: number } {
  const c = hexCenter(v.q, v.r, size);
  return { x: c.x, y: v.side === 'N' ? c.y - size : c.y + size };
}
