import { rngFromSeed } from '../rng';
import { EdgeKey } from './board';
import { coachPlacement, CoachReport, coachRoad, RoadReport } from './coach';
import { generateBoard } from './generator';
import {
  chooseOpponentMove, chooseOpponentRoad, OPPONENT_PROFILES, Personality,
} from './opponents';
import { isLegal, legalSetupRoads } from './rules';
import { Board, Placement, Road, VertexKey } from './types';

export const NUM_PLAYERS = 4;

export interface Seat {
  index: number;
  name: string;
  personality: Personality | 'human';
  tagline: string;
}

export interface MoveRecord {
  player: number;
  vertex: VertexKey;
  road: EdgeKey;
  auto: boolean;
}

export interface PuzzleSession {
  seed: string;
  board: Board;
  userSeat: number;
  seats: Seat[];
  /** Snake draft: seat indices in placement order, e.g. 0,1,2,3,3,2,1,0. */
  order: number[];
  /** Index into `order` of the current draft turn. */
  turn: number;
  placements: Placement[];
  roads: Road[];
  /** Completed turns (settlement + road pairs). */
  log: MoveRecord[];
  /** The user's settlement awaiting its road (phase 'user-road'). */
  pendingSettlement: VertexKey | null;
  /** Coach feedback for each of the user's settlements, in step order. */
  reports: CoachReport[];
  /** Coach feedback for each of the user's setup roads, in step order. */
  roadReports: RoadReport[];
  phase: 'user-settlement' | 'user-road' | 'done';
}

export function snakeOrder(players = NUM_PLAYERS): number[] {
  const forward = Array.from({ length: players }, (_, i) => i);
  return [...forward, ...forward.slice().reverse()];
}

function makeSeats(userSeat: number): Seat[] {
  const personalities: Personality[] = ['greedy', 'balanced', 'blocker'];
  let p = 0;
  return Array.from({ length: NUM_PLAYERS }, (_, index) => {
    if (index === userSeat) {
      return { index, name: 'You', personality: 'human' as const, tagline: 'That’s you — good luck!' };
    }
    const profile = OPPONENT_PROFILES[personalities[p++ % personalities.length]];
    return { index, name: profile.name, personality: profile.personality, tagline: profile.tagline };
  });
}

/** Play opponent turns (settlement + road) until the user is up or the draft ends. */
function runAuto(session: PuzzleSession): PuzzleSession {
  const s = {
    ...session,
    placements: [...session.placements],
    roads: [...session.roads],
    log: [...session.log],
  };
  while (s.turn < s.order.length) {
    const seatIdx = s.order[s.turn];
    if (seatIdx === s.userSeat) {
      s.phase = 'user-settlement';
      return s;
    }
    const seat = s.seats[seatIdx];
    const rnd = rngFromSeed(`${s.seed}:move:${s.turn}`);
    const vertex = chooseOpponentMove(
      s.board, s.placements, seatIdx, seat.personality as Personality, rnd, s.userSeat,
    );
    s.placements.push({ player: seatIdx, vertex });
    const road = chooseOpponentRoad(s.board, s.placements, s.roads, seatIdx, vertex, rnd);
    s.roads.push({ player: seatIdx, edge: road });
    s.log.push({ player: seatIdx, vertex, road, auto: true });
    s.turn++;
  }
  s.phase = 'done';
  return s;
}

/**
 * Create a puzzle: seeded board, 4-seat snake draft, opponents auto-play up to
 * the user's first decision. The user sits mid-draft (seat 2 by default) so both
 * picks react to opponent placements — that's what makes it a multi-step puzzle.
 */
export function createSession(seed: string, userSeat = 2): PuzzleSession {
  const session: PuzzleSession = {
    seed,
    board: generateBoard(seed),
    userSeat,
    seats: makeSeats(userSeat),
    order: snakeOrder(),
    turn: 0,
    placements: [],
    roads: [],
    log: [],
    pendingSettlement: null,
    reports: [],
    roadReports: [],
    phase: 'user-settlement',
  };
  return runAuto(session);
}

/**
 * Apply the user's settlement choice: grade it against the options they were
 * actually choosing from, then wait for the matching setup road (official
 * rules: each setup settlement is placed together with an attached road).
 */
export function placeUserSettlement(session: PuzzleSession, vertex: VertexKey): PuzzleSession {
  if (session.phase !== 'user-settlement') return session;
  if (!isLegal(session.board, session.placements, vertex)) return session;

  const step = session.reports.length + 1;
  const report = coachPlacement(session.board, session.placements, session.userSeat, vertex, step);

  return {
    ...session,
    placements: [...session.placements, { player: session.userSeat, vertex }],
    pendingSettlement: vertex,
    reports: [...session.reports, report],
    phase: 'user-road',
  };
}

/** Apply the user's setup road for the settlement they just placed. */
export function placeUserRoad(session: PuzzleSession, edge: EdgeKey): PuzzleSession {
  if (session.phase !== 'user-road' || session.pendingSettlement === null) return session;
  if (!legalSetupRoads(session.roads, session.pendingSettlement).includes(edge)) return session;

  const step = session.roadReports.length + 1;
  const report = coachRoad(
    session.board, session.placements, session.roads,
    session.userSeat, session.pendingSettlement, edge, step,
  );

  const s: PuzzleSession = {
    ...session,
    roads: [...session.roads, { player: session.userSeat, edge }],
    log: [
      ...session.log,
      { player: session.userSeat, vertex: session.pendingSettlement, road: edge, auto: false },
    ],
    roadReports: [...session.roadReports, report],
    pendingSettlement: null,
    turn: session.turn + 1,
  };
  return runAuto(s);
}
