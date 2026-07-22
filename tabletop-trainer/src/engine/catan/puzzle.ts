import { rngFromSeed } from '../rng';
import { coachPlacement, CoachReport } from './coach';
import { generateBoard } from './generator';
import { chooseOpponentMove, OPPONENT_PROFILES, Personality } from './opponents';
import { isLegal } from './rules';
import { Board, Placement, VertexKey } from './types';

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
  auto: boolean;
}

export interface PuzzleSession {
  seed: string;
  board: Board;
  userSeat: number;
  seats: Seat[];
  /** Snake draft: seat indices in placement order, e.g. 0,1,2,3,3,2,1,0. */
  order: number[];
  /** Index into `order` of the next placement. */
  turn: number;
  placements: Placement[];
  log: MoveRecord[];
  /** Coach feedback for each of the user's placements, in step order. */
  reports: CoachReport[];
  phase: 'user-turn' | 'done';
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

/** Play opponent turns until it's the user's turn or the draft is complete. */
function runAuto(session: PuzzleSession): PuzzleSession {
  const s = { ...session, placements: [...session.placements], log: [...session.log] };
  while (s.turn < s.order.length) {
    const seatIdx = s.order[s.turn];
    if (seatIdx === s.userSeat) {
      s.phase = 'user-turn';
      return s;
    }
    const seat = s.seats[seatIdx];
    const rnd = rngFromSeed(`${s.seed}:move:${s.turn}`);
    const vertex = chooseOpponentMove(
      s.board, s.placements, seatIdx, seat.personality as Personality, rnd, s.userSeat,
    );
    s.placements.push({ player: seatIdx, vertex });
    s.log.push({ player: seatIdx, vertex, auto: true });
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
    log: [],
    reports: [],
    phase: 'user-turn',
  };
  return runAuto(session);
}

/**
 * Apply the user's settlement choice: grade it against the options they were
 * actually choosing from, record it, then let opponents respond.
 */
export function placeUser(session: PuzzleSession, vertex: VertexKey): PuzzleSession {
  if (session.phase !== 'user-turn') return session;
  if (!isLegal(session.board, session.placements, vertex)) return session;

  const step = session.reports.length + 1;
  const report = coachPlacement(session.board, session.placements, session.userSeat, vertex, step);

  const s: PuzzleSession = {
    ...session,
    placements: [...session.placements, { player: session.userSeat, vertex }],
    log: [...session.log, { player: session.userSeat, vertex, auto: false }],
    reports: [...session.reports, report],
    turn: session.turn + 1,
  };
  return runAuto(s);
}
