/**
 * Public surface of the game engine.
 *
 * This barrel is the ONLY entry point consumers (web app, server functions)
 * should import from, so the engine can move into its own package without
 * touching call sites. Everything here is pure and deterministic — no DOM,
 * no I/O, no clock, no Math.random — which is what lets the server replay a
 * player's moves and grade them authoritatively.
 */

// Deterministic randomness
export { hashSeed, mulberry32, rngFromSeed, shuffled } from './rng';
export type { Rng } from './rng';

// Types
export type {
  Board, Hex, Placement, Port, Resource, Road, TileType, VertexId, VertexKey,
} from './catan/types';
export { PIPS, RESOURCES } from './catan/types';

// Topology & geometry
export {
  boardVertexKeys, coastRing, edgeEndpoints, edgeKey, hexCorners, hexCenter,
  isCoastal, parseVertexKey, touchingHexes, vertexEdges, vertexKey,
  vertexNeighbors, vertexPos,
} from './catan/board';
export type { EdgeKey } from './catan/board';

// Board generation
export { generateBoard, hexAt, redTokensLegal } from './catan/generator';

// Rules
export { isLegal, legalSetupRoads, legalVertices, occupiedSet } from './catan/rules';

// Evaluation (explainable scoring)
export {
  boardResourcePips, describeVertex, playerProduction, playerTokens, portAt,
  rankVertices, roadCandidates, scarcityWeights, scoreVertex, vertexProduction,
  vertexTokens, WEIGHTS,
} from './catan/evaluate';
export type { Production, RoadCandidate, ScoreBreakdown } from './catan/evaluate';

// Opponent agents
export {
  chooseOpponentMove, chooseOpponentRoad, opponentCandidates, OPPONENT_PROFILES,
} from './catan/opponents';
export type { OpponentProfile, Personality } from './catan/opponents';

// Coaching agent
export { coachPlacement, coachRoad, hints } from './catan/coach';
export type { CoachReport, Grade, RoadReport } from './catan/coach';

// Puzzle session (multi-step snake draft)
export {
  createSession, NUM_PLAYERS, placeUserRoad, placeUserSettlement, snakeOrder,
} from './catan/puzzle';
export type { MoveRecord, PuzzleSession, Seat } from './catan/puzzle';

// Server-side authoritative grading
export { gradeSubmission, GRADE_POINTS, MAX_POINTS_PER_PUZZLE } from './grade';
export type { PuzzleSubmission, GradedResult, GradedStep } from './grade';
