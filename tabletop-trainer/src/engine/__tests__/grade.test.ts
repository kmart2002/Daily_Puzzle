import { describe, expect, it } from 'vitest';
import { hints } from '../catan/coach';
import { rankVertices, roadCandidates } from '../catan/evaluate';
import { createSession, placeUserRoad, placeUserSettlement, PuzzleSession } from '../catan/puzzle';
import { gradeSubmission, GRADE_POINTS, PuzzleSubmission } from '../grade';

/** Build a submission by playing a seed with a chosen strategy. */
function buildSubmission(seed: string, strategy: 'best' | 'worst'): PuzzleSubmission {
  let s: PuzzleSession = createSession(seed);
  const turns: PuzzleSubmission['turns'] = [];
  while (s.phase !== 'done') {
    const ranked = rankVertices(s.board, s.placements, s.userSeat);
    const settlement =
      strategy === 'best'
        ? hints(s.board, s.placements, s.userSeat, 1)[0].spot.vertex
        : ranked[ranked.length - 1].vertex;
    const afterS = placeUserSettlement(s, settlement);
    const cands = roadCandidates(afterS.board, afterS.placements, afterS.roads, afterS.userSeat, settlement);
    const road = strategy === 'best' ? cands[0].edge : cands[cands.length - 1].edge;
    turns.push({ settlement, road });
    s = placeUserRoad(afterS, road);
  }
  return { seed, turns };
}

describe('server-side replay grading', () => {
  it('grades a perfect attempt at full marks', () => {
    const result = gradeSubmission(buildSubmission('grade-1', 'best'));
    expect(result.complete).toBe(true);
    expect(result.steps).toHaveLength(4); // 2 settlements + 2 roads
    expect(result.points).toBe(result.maxPoints);
    expect(result.points).toBe(GRADE_POINTS.S * 4);
    expect(result.grade).toBe('S');
    expect(result.steps.every((s) => s.grade === 'S')).toBe(true);
  });

  it('grades a deliberately bad attempt well below maximum', () => {
    const result = gradeSubmission(buildSubmission('grade-1', 'worst'));
    expect(result.complete).toBe(true);
    expect(result.points).toBeLessThan(result.maxPoints);
    expect(['C', 'D']).toContain(result.grade);
    expect(result.steps.some((s) => s.reasons.length > 0)).toBe(true);
  });

  it('is deterministic: identical submissions grade identically', () => {
    const submission = buildSubmission('grade-2', 'best');
    expect(gradeSubmission(submission)).toEqual(gradeSubmission(submission));
  });

  it('points are derived from the engine, not from anything client-supplied', () => {
    const submission = buildSubmission('grade-3', 'worst');
    // A client that tampers with extra fields cannot change the outcome.
    const tampered = { ...submission, points: 999999, grade: 'S' } as PuzzleSubmission;
    expect(gradeSubmission(tampered).points).toBe(gradeSubmission(submission).points);
    expect(gradeSubmission(tampered).points).toBeLessThan(gradeSubmission(tampered).maxPoints);
  });

  it('rejects an illegal settlement (a spot an opponent already took)', () => {
    const session = createSession('grade-4');
    const taken = session.placements[0].vertex;
    const valid = buildSubmission('grade-4', 'best');
    const cheat: PuzzleSubmission = {
      seed: 'grade-4',
      turns: [{ settlement: taken, road: valid.turns[0].road }, valid.turns[1]],
    };
    expect(() => gradeSubmission(cheat)).toThrow(/illegal settlement/);
  });

  it('rejects a road not attached to the settlement just placed', () => {
    const valid = buildSubmission('grade-5', 'best');
    const cheat: PuzzleSubmission = {
      seed: 'grade-5',
      turns: [{ settlement: valid.turns[0].settlement, road: valid.turns[1].road }, valid.turns[1]],
    };
    expect(() => gradeSubmission(cheat)).toThrow(/illegal road/);
  });

  it('rejects wrong-length and malformed submissions', () => {
    const valid = buildSubmission('grade-6', 'best');
    expect(() => gradeSubmission({ seed: 'grade-6', turns: [valid.turns[0]] })).toThrow(/expected 2 turns/);
    expect(() => gradeSubmission({ seed: '', turns: [] })).toThrow(/missing seed/);
    expect(() =>
      gradeSubmission({ seed: 'grade-6', turns: null as unknown as PuzzleSubmission['turns'] }),
    ).toThrow(/must be an array/);
  });

  it('grades against the submitted seed, so a good line on one board is not a free score on another', () => {
    // Vertex/edge ids are topological, so moves from another board are often
    // still *legal* here — but they are graded against THIS board's tiles and
    // opponents, so they earn no borrowed credit. (The caller is responsible
    // for pinning the seed to the user's assigned daily puzzle.)
    const optimalForA = buildSubmission('grade-7', 'best');
    const onA = gradeSubmission(optimalForA);
    expect(onA.points).toBe(onA.maxPoints);

    let sameMovesElsewhere = 0;
    for (const otherSeed of ['grade-8', 'grade-9', 'grade-10', 'grade-11']) {
      let graded;
      try {
        graded = gradeSubmission({ ...optimalForA, seed: otherSeed });
      } catch {
        continue; // illegal on that board — also fine
      }
      expect(graded.seed).toBe(otherSeed);
      if (graded.points < graded.maxPoints) sameMovesElsewhere++;
    }
    // A line tuned for one board should not be perfect on every other board.
    expect(sameMovesElsewhere).toBeGreaterThan(0);
  });
});
