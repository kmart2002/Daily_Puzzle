import { describe, expect, it } from 'vitest';
import { isCoastal, parseVertexKey, vertexNeighbors, vertexKey } from '../board';
import { generateBoard, redTokensLegal } from '../generator';
import { TileType } from '../types';

const SEEDS = ['daily-2026-07-22', 'alpha', 'bravo', 'charlie', 'delta', 'echo'];

describe('board generator', () => {
  it('uses the exact standard tile pool', () => {
    for (const seed of SEEDS) {
      const counts = new Map<TileType, number>();
      for (const h of generateBoard(seed).hexes) {
        counts.set(h.tile, (counts.get(h.tile) ?? 0) + 1);
      }
      expect(counts.get('lumber')).toBe(4);
      expect(counts.get('wool')).toBe(4);
      expect(counts.get('grain')).toBe(4);
      expect(counts.get('brick')).toBe(3);
      expect(counts.get('ore')).toBe(3);
      expect(counts.get('desert')).toBe(1);
    }
  });

  it('uses the exact standard token pool; desert has no token', () => {
    for (const seed of SEEDS) {
      const tokens = generateBoard(seed)
        .hexes.filter((h) => h.tile !== 'desert')
        .map((h) => h.token)
        .sort((a, b) => (a ?? 0) - (b ?? 0));
      expect(tokens).toEqual([2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]);
      const desert = generateBoard(seed).hexes.find((h) => h.tile === 'desert');
      expect(desert?.token).toBeNull();
    }
  });

  it('never places 6 and 8 on adjacent hexes', () => {
    for (const seed of SEEDS) {
      expect(redTokensLegal(generateBoard(seed).hexes)).toBe(true);
    }
  });

  it('is deterministic: same seed → identical board; different seed → different board', () => {
    expect(generateBoard('alpha')).toEqual(generateBoard('alpha'));
    expect(JSON.stringify(generateBoard('alpha').hexes)).not.toEqual(
      JSON.stringify(generateBoard('bravo').hexes),
    );
  });

  it('places 9 ports (4× 3:1 and one 2:1 per resource) on adjacent coastal vertex pairs', () => {
    for (const seed of SEEDS) {
      const board = generateBoard(seed);
      expect(board.ports).toHaveLength(9);
      const kinds = board.ports.map((p) => p.kind).sort();
      expect(kinds).toEqual(['any', 'any', 'any', 'any', 'brick', 'grain', 'lumber', 'ore', 'wool']);
      const used = new Set<string>();
      for (const port of board.ports) {
        const [a, b] = port.vertices;
        expect(isCoastal(parseVertexKey(a))).toBe(true);
        expect(isCoastal(parseVertexKey(b))).toBe(true);
        expect(vertexNeighbors(parseVertexKey(a)).map(vertexKey)).toContain(b);
        expect(used.has(a)).toBe(false);
        expect(used.has(b)).toBe(false);
        used.add(a);
        used.add(b);
      }
    }
  });
});
