import { describe, expect, it } from 'vitest';
import { hints } from '../coach';
import { legalVertices, isLegal } from '../rules';
import { rankVertices } from '../evaluate';
import { createSession, placeUser, PuzzleSession, snakeOrder } from '../puzzle';

function playBest(session: PuzzleSession): PuzzleSession {
  let s = session;
  while (s.phase === 'user-turn') {
    const [top] = hints(s.board, s.placements, s.userSeat, 1);
    s = placeUser(s, top.spot.vertex);
  }
  return s;
}

describe('puzzle session (multi-step snake draft)', () => {
  it('uses a 4-player snake order', () => {
    expect(snakeOrder()).toEqual([0, 1, 2, 3, 3, 2, 1, 0]);
  });

  it('pauses at the user turn with opponents already placed', () => {
    const s = createSession('seed-1');
    expect(s.phase).toBe('user-turn');
    expect(s.placements).toHaveLength(2); // seats 0 and 1 placed before seat 2
    expect(s.placements.every((p) => p.player !== s.userSeat)).toBe(true);
  });

  it('completes a full draft: 8 settlements, 2 per seat, all legal when placed', () => {
    const s = playBest(createSession('seed-2'));
    expect(s.phase).toBe('done');
    expect(s.placements).toHaveLength(8);
    for (let seat = 0; seat < 4; seat++) {
      expect(s.placements.filter((p) => p.player === seat)).toHaveLength(2);
    }
    // Replay: each placement was legal given everything placed before it.
    for (let i = 0; i < s.placements.length; i++) {
      expect(isLegal(s.board, s.placements.slice(0, i), s.placements[i].vertex)).toBe(true);
    }
  });

  it('is fully deterministic: same seed → identical game and reports', () => {
    const a = playBest(createSession('seed-3'));
    const b = playBest(createSession('seed-3'));
    expect(a.placements).toEqual(b.placements);
    expect(a.log).toEqual(b.log);
    expect(a.reports.map((r) => r.grade)).toEqual(b.reports.map((r) => r.grade));
  });

  it('coach gives S for the best move and a low grade for the worst', () => {
    const best = playBest(createSession('seed-4'));
    expect(best.reports).toHaveLength(2);
    expect(best.reports.every((r) => r.grade === 'S')).toBe(true);

    let worst = createSession('seed-4');
    while (worst.phase === 'user-turn') {
      const ranked = rankVertices(worst.board, worst.placements, worst.userSeat);
      worst = placeUser(worst, ranked[ranked.length - 1].vertex);
    }
    for (const report of worst.reports) {
      expect(report.rank).toBeGreaterThan(1);
      expect(['C', 'D']).toContain(report.grade);
      expect(report.details.length).toBeGreaterThan(1);
    }
  });

  it('rejects illegal user moves without changing state', () => {
    const s = createSession('seed-5');
    const occupied = s.placements[0].vertex;
    expect(placeUser(s, occupied)).toBe(s);
  });

  it('greedy opener (seat 0) takes the highest-pip vertex available', () => {
    const s = createSession('seed-6');
    const first = s.log[0];
    expect(first.player).toBe(0);
    const board = s.board;
    const allPips = legalVertices(board, []).map(
      (v) => rankVertices(board, [], 0).find((r) => r.vertex === v)!.pips,
    );
    const chosenPips = rankVertices(board, [], 0).find((r) => r.vertex === first.vertex)!.pips;
    expect(chosenPips).toBe(Math.max(...allPips));
  });
});
