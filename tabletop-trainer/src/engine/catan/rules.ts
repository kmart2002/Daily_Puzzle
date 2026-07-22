import { parseVertexKey, vertexKey, vertexNeighbors } from './board';
import { Board, Placement, VertexKey } from './types';

export function occupiedSet(placements: Placement[]): Set<VertexKey> {
  return new Set(placements.map((p) => p.vertex));
}

/**
 * Settlement legality during setup: vertex must exist on the board, be empty,
 * and satisfy the distance rule (no settlement on any adjacent vertex).
 */
export function isLegal(board: Board, placements: Placement[], vertex: VertexKey): boolean {
  if (!board.vertexKeys.includes(vertex)) return false;
  const occupied = occupiedSet(placements);
  if (occupied.has(vertex)) return false;
  return !vertexNeighbors(parseVertexKey(vertex))
    .map(vertexKey)
    .some((n) => occupied.has(n));
}

export function legalVertices(board: Board, placements: Placement[]): VertexKey[] {
  const occupied = occupiedSet(placements);
  const blocked = new Set<VertexKey>(occupied);
  for (const v of occupied) {
    for (const n of vertexNeighbors(parseVertexKey(v))) blocked.add(vertexKey(n));
  }
  return board.vertexKeys.filter((v) => !blocked.has(v));
}
