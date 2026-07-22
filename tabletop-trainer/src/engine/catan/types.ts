export type Resource = 'brick' | 'lumber' | 'ore' | 'grain' | 'wool';
export type TileType = Resource | 'desert';

export const RESOURCES: readonly Resource[] = ['brick', 'lumber', 'ore', 'grain', 'wool'];

export interface Hex {
  q: number;
  r: number;
  tile: TileType;
  /** Number token 2–12 (never 7); null for desert. */
  token: number | null;
}

/**
 * Canonical vertex id: every vertex of a pointy-top hex grid is either the
 * North corner of exactly one hex position or the South corner of one.
 * This gives exact vertex identity with no floating-point comparisons.
 */
export interface VertexId {
  q: number;
  r: number;
  side: 'N' | 'S';
}

/** Serialized VertexId, e.g. "1,-2,N" — used as map keys and in Placements. */
export type VertexKey = string;

export interface Port {
  /** The two coastal vertices this port serves. */
  vertices: [VertexKey, VertexKey];
  /** 'any' = 3:1 generic port; a resource = 2:1 port for that resource. */
  kind: Resource | 'any';
}

export interface Board {
  seed: string;
  hexes: Hex[];
  /** All 54 buildable vertices. */
  vertexKeys: VertexKey[];
  ports: Port[];
}

export interface Placement {
  player: number;
  vertex: VertexKey;
}

export interface Road {
  player: number;
  /** EdgeKey from board.ts: the two endpoint vertex keys joined by "|". */
  edge: string;
}

/** Pips (probability dots) per number token — how often the number rolls. */
export const PIPS: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};
