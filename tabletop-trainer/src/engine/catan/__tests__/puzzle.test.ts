import { describe, expect, it } from 'vitest';
import { edgeEndpoints } from '../board';
import { hints } from '../coach';
import { legalVertices, isLegal, legalSetupRoads } from '../rules';
import { rankVertices, roadCandidates } from '../evaluate';
import {
  createSession, placeUserRoad, placeUserSettlement, PuzzleSession, snakeOrder,
} from '../puzzle';

function playBest(session: PuzzleSession): PuzzleSession {
  let s = session;
  while (s.phase !== 'done') {
    if (s.phase === 'user-settlement') {
      const [top] = hints(s.board, s.placements, s.userSeat, 1);
      s = placeUserSettlement(s, top.spot.vertex);
    } else {
      const best = roadCandidates(s.board, s.placements, s.roads, s.userSeat, s.pendingSettlement!)[0];
      s = placeUserRoad(s, best.edge);
    }
  }
  return s;
}

describe('puzzle session (multi-step snake draft)', () => {
  it('uses a 4-player snake order', () => {
    expect(snakeOrder()).toEqual([0, 1, 2, 3, 3, 2, 1, 0]);
  });

  it('pauses at the user turn with opponents already placed', () => {
    const s = createSession('seed-1');
    expect(s.phase).toBe('user-settlement');
    expect(s.placements).toHaveLength(2); // seats 0 and 1 placed before seat 2
    expect(s.roads).toHaveLength(2); // each opponent settlement came with a road
    expect(s.placements.every((p) => p.player !== s.userSeat)).toBe(true);
  });

  it('requires a road after the user settlement before the draft continues', () => {
    const s0 = createSession('seed-1');
    const [top] = hints(s0.board, s0.placements, s0.userSeat, 1);
    const s1 = placeUserSettlement(s0, top.spot.vertex);
    expect(s1.phase).toBe('user-road');
    expect(s1.pendingSettlement).toBe(top.spot.vertex);
    // A settlement click in road phase is ignored.
    expect(placeUserSettlement(s1, legalVertices(s1.board, s1.placements)[0])).toBe(s1);
    // A road not attached to the pending settlement is ignored.
    const foreignRoad = s1.roads[0].edge;
    expect(placeUserRoad(s1, foreignRoad)).toBe(s1);
  });

  it('completes a full draft: 8 settlements + 8 attached roads, all legal when placed', () => {
    const s = playBest(createSession('seed-2'));
    expect(s.phase).toBe('done');
    expect(s.placements).toHaveLength(8);
    expect(s.roads).toHaveLength(8);
    expect(new Set(s.roads.map((r) => r.edge)).size).toBe(8);
    for (let seat = 0; seat < 4; seat++) {
      expect(s.placements.filter((p) => p.player === seat)).toHaveLength(2);
      expect(s.roads.filter((r) => r.player === seat)).toHaveLength(2);
    }
    // Replay: each placement was legal given everything placed before it.
    for (let i = 0; i < s.placements.length; i++) {
      expect(isLegal(s.board, s.placements.slice(0, i), s.placements[i].vertex)).toBe(true);
    }
    // Every setup road is attached to a settlement of the same player.
    for (const road of s.roads) {
      const ends = edgeEndpoints(road.edge);
      const own = s.placements.filter((p) => p.player === road.player).map((p) => p.vertex);
      expect(ends.some((v) => own.includes(v))).toBe(true);
    }
    // The log pairs each settlement with its road, in draft order.
    expect(s.log.map((m) => m.player)).toEqual(snakeOrder());
  });

  it('is fully deterministic: same seed → identical game and reports', () => {
    const a = playBest(createSession('seed-3'));
    const b = playBest(createSession('seed-3'));
    expect(a.placements).toEqual(b.placements);
    expect(a.roads).toEqual(b.roads);
    expect(a.log).toEqual(b.log);
    expect(a.reports.map((r) => r.grade)).toEqual(b.reports.map((r) => r.grade));
    expect(a.roadReports.map((r) => r.grade)).toEqual(b.roadReports.map((r) => r.grade));
  });

  it('coach gives S for the best moves and a low grade for the worst settlement', () => {
    const best = playBest(createSession('seed-4'));
    expect(best.reports).toHaveLength(2);
    expect(best.roadReports).toHaveLength(2);
    expect(best.reports.every((r) => r.grade === 'S')).toBe(true);
    expect(best.roadReports.every((r) => r.grade === 'S')).toBe(true);

    let worst = createSession('seed-4');
    while (worst.phase !== 'done') {
      if (worst.phase === 'user-settlement') {
        const ranked = rankVertices(worst.board, worst.placements, worst.userSeat);
        worst = placeUserSettlement(worst, ranked[ranked.length - 1].vertex);
      } else {
        const cands = roadCandidates(
          worst.board, worst.placements, worst.roads, worst.userSeat, worst.pendingSettlement!,
        );
        worst = placeUserRoad(worst, cands[cands.length - 1].edge);
      }
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
    expect(placeUserSettlement(s, occupied)).toBe(s);
    expect(placeUserRoad(s, s.roads[0].edge)).toBe(s); // wrong phase
  });

  it('greedy opener (seat 0) takes the highest-pip vertex available', () => {
    const s = createSession('seed-6');
    const first = s.log[0];
    expect(first.player).toBe(0);
    const ranked = rankVertices(s.board, [], 0);
    const allPips = ranked.map((r) => r.pips);
    const chosenPips = ranked.find((r) => r.vertex === first.vertex)!.pips;
    expect(chosenPips).toBe(Math.max(...allPips));
  });

  it('setup roads: exactly the free edges of the pending settlement are legal', () => {
    const s0 = createSession('seed-7');
    const [top] = hints(s0.board, s0.placements, s0.userSeat, 1);
    const s1 = placeUserSettlement(s0, top.spot.vertex);
    const legal = legalSetupRoads(s1.roads, s1.pendingSettlement!);
    expect(legal.length).toBeGreaterThanOrEqual(2);
    expect(legal.length).toBeLessThanOrEqual(3);
    for (const edge of legal) {
      expect(edgeEndpoints(edge)).toContain(s1.pendingSettlement);
    }
  });
});
