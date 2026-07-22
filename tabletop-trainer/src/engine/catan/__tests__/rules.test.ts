import { describe, expect, it } from 'vitest';
import { parseVertexKey, vertexKey, vertexNeighbors } from '../board';
import { generateBoard } from '../generator';
import { isLegal, legalVertices } from '../rules';

const board = generateBoard('rules-test');

describe('settlement legality (setup phase)', () => {
  it('all 54 vertices are legal on an empty board', () => {
    expect(legalVertices(board, [])).toHaveLength(54);
  });

  it('rejects vertices that are not on the board', () => {
    expect(isLegal(board, [], '9,9,N')).toBe(false);
  });

  it('an occupied vertex and its neighbors become illegal (distance rule)', () => {
    const spot = board.vertexKeys[10];
    const placements = [{ player: 0, vertex: spot }];
    expect(isLegal(board, placements, spot)).toBe(false);
    for (const n of vertexNeighbors(parseVertexKey(spot))) {
      expect(isLegal(board, placements, vertexKey(n))).toBe(false);
    }
    const legal = legalVertices(board, placements);
    expect(legal).not.toContain(spot);
    expect(legal.length).toBeLessThan(54);
    expect(legal.length).toBeGreaterThanOrEqual(50);
  });

  it('vertices two edges away stay legal', () => {
    const spot = parseVertexKey(board.vertexKeys[10]);
    const placements = [{ player: 0, vertex: vertexKey(spot) }];
    const oneAway = new Set(vertexNeighbors(spot).map(vertexKey));
    for (const n of vertexNeighbors(spot)) {
      for (const nn of vertexNeighbors(n)) {
        const key = vertexKey(nn);
        if (key === vertexKey(spot) || oneAway.has(key)) continue;
        if (!board.vertexKeys.includes(key)) continue;
        expect(isLegal(board, placements, key)).toBe(true);
      }
    }
  });
});
