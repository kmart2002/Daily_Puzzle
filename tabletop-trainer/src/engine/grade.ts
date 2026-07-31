/**
 * Authoritative scoring for a submitted puzzle attempt.
 *
 * The client sends the MOVES a player made — never a score. The server replays
 * those moves through the same deterministic engine and computes the points
 * itself, so a score can only be earned by actually making the moves that earn
 * it. Pure and deterministic: same submission always grades identically, on any
 * machine, which is what makes a shared leaderboard trustworthy.
 */
import { Grade } from './catan/coach';
import { createSession, placeUserRoad, placeUserSettlement, PuzzleSession } from './catan/puzzle';
import { EdgeKey } from './catan/board';
import { VertexKey } from './catan/types';

/** Points awarded per decision grade. */
export const GRADE_POINTS: Record<Grade, number> = {
  S: 100,
  A: 80,
  B: 60,
  C: 35,
  D: 10,
};

/** A perfect attempt: 2 settlements + 2 roads, all graded S. */
export const MAX_POINTS_PER_PUZZLE = GRADE_POINTS.S * 4;

/** What a client submits: the seed played and the moves made, in order. */
export interface PuzzleSubmission {
  seed: string;
  /** The player's settlement/road choices, in the order they were made. */
  turns: { settlement: VertexKey; road: EdgeKey }[];
}

export interface GradedStep {
  step: number;
  kind: 'settlement' | 'road';
  choice: string;
  grade: Grade;
  points: number;
  /** 1-based rank among the options available at decision time. */
  rank: number;
  outOf: number;
  /** Coach sentences explaining the decision. */
  reasons: string[];
}

export interface GradedResult {
  seed: string;
  /** Server-computed total — the only score the leaderboard should trust. */
  points: number;
  maxPoints: number;
  /** Overall grade derived from the share of available points earned. */
  grade: Grade;
  steps: GradedStep[];
  /** True when every submitted move was legal and the attempt completed. */
  complete: boolean;
}

function overallGrade(points: number, max: number): Grade {
  const pct = max === 0 ? 0 : points / max;
  if (pct >= 0.97) return 'S';
  if (pct >= 0.85) return 'A';
  if (pct >= 0.65) return 'B';
  if (pct >= 0.4) return 'C';
  return 'D';
}

/**
 * Replay a submission and grade it. Throws on an illegal or malformed
 * submission — callers should treat that as a rejected attempt rather than a
 * zero score, so bad clients can't quietly poison the leaderboard.
 */
export function gradeSubmission(submission: PuzzleSubmission): GradedResult {
  const { seed, turns } = submission;
  if (typeof seed !== 'string' || !seed) throw new Error('submission: missing seed');
  if (!Array.isArray(turns)) throw new Error('submission: turns must be an array');

  let session: PuzzleSession = createSession(seed);
  const expectedTurns = session.order.filter((s) => s === session.userSeat).length;
  if (turns.length !== expectedTurns) {
    throw new Error(`submission: expected ${expectedTurns} turns, got ${turns.length}`);
  }

  for (const [i, turn] of turns.entries()) {
    if (session.phase !== 'user-settlement') {
      throw new Error(`submission: turn ${i + 1} out of sequence`);
    }
    const afterSettlement = placeUserSettlement(session, turn.settlement);
    if (afterSettlement === session) {
      throw new Error(`submission: illegal settlement "${turn.settlement}" on turn ${i + 1}`);
    }
    const afterRoad = placeUserRoad(afterSettlement, turn.road);
    if (afterRoad === afterSettlement) {
      throw new Error(`submission: illegal road "${turn.road}" on turn ${i + 1}`);
    }
    session = afterRoad;
  }

  const steps: GradedStep[] = [];
  let points = 0;
  for (const [i, report] of session.reports.entries()) {
    const settlementPoints = GRADE_POINTS[report.grade];
    points += settlementPoints;
    steps.push({
      step: report.step,
      kind: 'settlement',
      choice: report.chosen.vertex,
      grade: report.grade,
      points: settlementPoints,
      rank: report.rank,
      outOf: report.outOf,
      reasons: report.details,
    });

    const roadReport = session.roadReports[i];
    if (roadReport) {
      const roadPoints = GRADE_POINTS[roadReport.grade];
      points += roadPoints;
      steps.push({
        step: roadReport.step,
        kind: 'road',
        choice: roadReport.chosen.edge,
        grade: roadReport.grade,
        points: roadPoints,
        rank: roadReport.rank,
        outOf: roadReport.outOf,
        reasons: roadReport.details,
      });
    }
  }

  const maxPoints = GRADE_POINTS.S * steps.length;
  return {
    seed,
    points,
    maxPoints,
    grade: overallGrade(points, maxPoints),
    steps,
    complete: session.phase === 'done',
  };
}
