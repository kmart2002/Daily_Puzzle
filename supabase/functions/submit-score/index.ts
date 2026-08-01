/**
 * POST /submit-score — record a player's attempt at one daily puzzle.
 *
 * Trust model: the client sends the MOVES it made, never a score. This function
 * replays them through the shared engine and writes the points it computes
 * itself. A tampered payload cannot inflate a score, because the score is never
 * read from the request.
 *
 * Deployed on Supabase Edge Functions (Deno). Secrets come from the function
 * environment — nothing here ever ships to the browser.
 *
 * Request body: { email, seed, puzzleIndex, turns: [{ settlement, road }] }
 * Auth: Bearer token identifying the player (magic-link session or the signed
 * token embedded in their daily email link).
 */
// @ts-nocheck -- Deno/edge runtime types are not part of the web app's tsconfig.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { gradeSubmission } from '../_shared/engine/index.ts';
import { json, preflight } from '../_shared/http.ts';
import { dailySeeds, utcDate, verifyPlayToken } from '../_shared/server/tokens.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Seeds and the day boundary come from the shared module, so the mailer and the
// grader can never drift apart on what "today's puzzle 3" means.

Deno.serve(async (req) => {
  // The static site calls this cross-origin, so preflight must be answered.
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // --- Identify the player from their signed token; never from the body. ---
  // Accepts either the emailed daily link ('play') or a magic-link sign-in
  // ('session'). The email is read from the verified payload, so a caller can
  // only ever score as themselves.
  const signingSecret = Deno.env.get('PLAY_TOKEN_SECRET');
  if (!signingSecret) return json({ error: 'server not configured' }, 500);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'missing authorization' }, 401);

  const claims =
    (await verifyPlayToken(token, signingSecret, Date.now(), 'session')) ??
    (await verifyPlayToken(token, signingSecret, Date.now(), 'play'));
  if (!claims) return json({ error: 'invalid or expired sign-in' }, 401);
  const email = claims.email;

  let body: { seed?: string; puzzleIndex?: number; turns?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const puzzleDate = utcDate();
  // A daily-link token is valid only for its own puzzle date; a session token
  // is not day-scoped and may submit any day it is used on.
  if ((claims.scope ?? 'play') === 'play' && claims.date !== puzzleDate) {
    return json({ error: 'that link is for a different day’s puzzles' }, 403);
  }
  const puzzleIndex = Number(body.puzzleIndex);
  if (!Number.isInteger(puzzleIndex) || puzzleIndex < 1 || puzzleIndex > 5) {
    return json({ error: 'puzzleIndex must be 1-5' }, 400);
  }

  // Pin the seed to today's set: a client cannot submit an easier board.
  const expectedSeed = dailySeeds(puzzleDate)[puzzleIndex - 1];
  if (body.seed !== expectedSeed) {
    return json({ error: 'seed does not match today’s puzzle' }, 400);
  }

  // --- Authoritative grading: replay the moves through the engine. ---
  let graded;
  try {
    graded = gradeSubmission({ seed: expectedSeed, turns: body.turns as never });
  } catch (e) {
    return json({ error: `rejected submission: ${(e as Error).message}` }, 422);
  }
  if (!graded.complete) return json({ error: 'attempt is incomplete' }, 422);

  // --- First attempt wins: the primary key makes this atomic. ---
  const { error: insertError } = await admin.from('scores').insert({
    email,
    puzzle_date: puzzleDate,
    puzzle_index: puzzleIndex,
    seed: expectedSeed,
    moves: body.turns,
    points: graded.points,
    grade: graded.grade,
    breakdown: graded.steps,
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return json({ error: 'already submitted for this puzzle today' }, 409);
    }
    return json({ error: 'could not record score' }, 500);
  }

  return json({
    points: graded.points,
    maxPoints: graded.maxPoints,
    grade: graded.grade,
    steps: graded.steps,
  }, 201);
});
