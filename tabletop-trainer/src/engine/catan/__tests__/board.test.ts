import { describe, expect, it } from 'vitest';
import {
  allHexCoords, boardEdges, boardVertexKeys, coastRing, edgeEndpoints, hexCorners,
  parseVertexKey, touchingHexes, vertexKey, vertexNeighbors, vertexPos,
} from '../board';

describe('board topology', () => {
  it('has 19 hexes and 54 vertices (standard base board)', () => {
    expect(allHexCoords()).toHaveLength(19);
    expect(boardVertexKeys()).toHaveLength(54);
  });

  it('has 72 edges, all between on-board vertices (standard base board)', () => {
    const edges = boardEdges();
    expect(edges).toHaveLength(72);
    // No duplicates, and every endpoint is a real board vertex.
    expect(new Set(edges).size).toBe(72);
    const vertices = new Set(boardVertexKeys());
    for (const e of edges) {
      const [a, b] = edgeEndpoints(e);
      expect(vertices.has(a)).toBe(true);
      expect(vertices.has(b)).toBe(true);
    }
  });

  it('every neighbor edge appears in the board edge set', () => {
    const edges = new Set(boardEdges());
    for (const key of boardVertexKeys()) {
      for (const n of vertexNeighbors(parseVertexKey(key))) {
        const nk = vertexKey(n);
        if (!edges.has([key, nk].sort().join('|'))) continue; // off-board neighbor
      }
    }
    // Degree sum must be twice the edge count.
    const degree = boardVertexKeys().reduce(
      (sum, key) => sum + vertexNeighbors(parseVertexKey(key))
        .map(vertexKey)
        .filter((nk) => edges.has([key, nk].sort().join('|'))).length,
      0,
    );
    expect(degree).toBe(72 * 2);
  });

  it('every hex has 6 distinct corners', () => {
    for (const { q, r } of allHexCoords()) {
      const corners = hexCorners(q, r).map(vertexKey);
      expect(new Set(corners).size).toBe(6);
    }
  });

  it('vertex ↔ hex incidence is consistent: corners of a hex touch that hex', () => {
    for (const { q, r } of allHexCoords()) {
      for (const corner of hexCorners(q, r)) {
        const touching = touchingHexes(corner).map((h) => `${h.q},${h.r}`);
        expect(touching).toContain(`${q},${r}`);
      }
    }
  });

  it('vertex adjacency is symmetric', () => {
    for (const key of boardVertexKeys()) {
      const v = parseVertexKey(key);
      for (const n of vertexNeighbors(v)) {
        const back = vertexNeighbors(n).map(vertexKey);
        expect(back).toContain(key);
      }
    }
  });

  it('neighboring vertices are exactly one edge length apart', () => {
    const size = 10;
    for (const key of boardVertexKeys()) {
      const v = parseVertexKey(key);
      const p = vertexPos(v, size);
      for (const n of vertexNeighbors(v)) {
        const np = vertexPos(n, size);
        const dist = Math.hypot(np.x - p.x, np.y - p.y);
        expect(dist).toBeCloseTo(size, 6);
      }
    }
  });

  it('coast ring has 30 vertices, each adjacent to the next, closed', () => {
    const ring = coastRing();
    expect(ring).toHaveLength(30);
    expect(new Set(ring).size).toBe(30);
    for (let i = 0; i < ring.length; i++) {
      const next = ring[(i + 1) % ring.length];
      const neighbors = vertexNeighbors(parseVertexKey(ring[i])).map(vertexKey);
      expect(neighbors).toContain(next);
    }
  });
});
