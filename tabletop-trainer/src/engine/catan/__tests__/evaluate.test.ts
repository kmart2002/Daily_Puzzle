import { describe, expect, it } from 'vitest';
import { generateBoard } from '../generator';
import {
  boardResourcePips, rankVertices, scarcityWeights, scoreVertex, vertexProduction,
} from '../evaluate';
import { Board, PIPS } from '../types';

/** Hand-built board: mostly desert, with a known strong corner and a weak one. */
function goldenBoard(): Board {
  const board = generateBoard('golden-base');
  board.hexes = board.hexes.map((h) => ({ ...h, tile: 'desert' as const, token: null }));
  const set = (q: number, r: number, tile: 'grain' | 'ore' | 'wool' | 'brick', token: number) => {
    const hex = board.hexes.find((h) => h.q === q && h.r === r)!;
    hex.tile = tile;
    hex.token = token;
  };
  // Vertex "0,0,N" touches (0,0), (0,-1), (1,-1) → the strong corner.
  set(0, 0, 'grain', 6);
  set(0, -1, 'ore', 8);
  set(1, -1, 'wool', 5);
  // A weak spot far away: single low-probability hex.
  set(-1, 2, 'brick', 2);
  return board;
}

describe('evaluation', () => {
  it('sums vertex production correctly from adjacent tokens', () => {
    const prod = vertexProduction(goldenBoard(), '0,0,N');
    expect(prod).toEqual({ grain: PIPS[6], ore: PIPS[8], wool: PIPS[5] });
  });

  it('board totals and scarcity weights reflect the tiles', () => {
    const board = goldenBoard();
    const totals = boardResourcePips(board);
    expect(totals.grain).toBe(5);
    expect(totals.ore).toBe(5);
    expect(totals.wool).toBe(4);
    expect(totals.brick).toBe(1);
    expect(totals.lumber).toBe(0);
    const w = scarcityWeights(board);
    expect(w.brick).toBeGreaterThan(w.grain); // scarce brick is worth more per pip
    expect(w.lumber).toBe(1.5); // clamped max for an absent resource
  });

  it('golden position: the 6/8/5 corner is the #1 ranked spot on an empty board', () => {
    const ranked = rankVertices(goldenBoard(), [], 0);
    expect(ranked[0].vertex).toBe('0,0,N');
    expect(ranked[0].pips).toBe(14);
    expect(ranked[0].newResources.sort()).toEqual(['grain', 'ore', 'wool']);
  });

  it('score total equals the sum of its explainable components', () => {
    const board = generateBoard('component-sum');
    for (const s of rankVertices(board, [], 0).slice(0, 10)) {
      const sum =
        s.weightedPips + s.diversityBonus + s.comboBonus + s.portBonus + s.expansionBonus;
      expect(s.total).toBeCloseTo(sum, 9);
    }
  });

  it('second placement values resources the player is missing', () => {
    const board = goldenBoard();
    // First settlement already covers grain/ore/wool.
    const placements = [{ player: 0, vertex: '0,0,N' }];
    // Any brick vertex now scores diversity; a duplicate grain-only vertex does not.
    const brickVertex = '-1,2,N'; // touches (-1,2) brick-2
    const s = scoreVertex(board, placements, 0, brickVertex);
    expect(s.newResources).toEqual(['brick']);
    expect(s.diversityBonus).toBeGreaterThan(0);
    const dup = scoreVertex(board, placements, 0, '0,1,N'); // touches (0,0) grain only
    expect(dup.newResources).toEqual([]);
    expect(dup.diversityBonus).toBe(0);
  });

  it('ranking is deterministic for a given seed', () => {
    const a = rankVertices(generateBoard('det'), [], 1).map((s) => s.vertex);
    const b = rankVertices(generateBoard('det'), [], 1).map((s) => s.vertex);
    expect(a).toEqual(b);
  });
});
