/**
 * GET /leaderboard?range=today|week|all — public standings.
 *
 * Reads the `daily_leaderboard` view, which exposes display names only. Emails
 * are never returned by this endpoint: they are the primary key internally, but
 * they are private data and must not leak through a public board.
 *
 * No auth required — this is meant to be linked from the daily email and shared.
 */
// @ts-nocheck -- Deno/edge runtime types are not part of the web app's tsconfig.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { utcDate } from '../_shared/server/tokens.ts';
import { json, preflight } from '../_shared/http.ts';

type Range = 'today' | 'week' | 'all';

/** Inclusive start date for a range, or null for all-time. */
function startDate(range: Range, today: string): string | null {
  if (range === 'all') return null;
  if (range === 'today') return today;
  const from = new Date(`${today}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 6); // rolling 7 days including today
  return from.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const requested = new URL(req.url).searchParams.get('range') ?? 'today';
  const range: Range = requested === 'week' || requested === 'all' ? requested : 'today';

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const today = utcDate();
  const from = startDate(range, today);

  // The view is already aggregated per player per day; for multi-day ranges we
  // re-aggregate across the window.
  let query = admin
    .from('daily_leaderboard')
    .select('display_name, total_points, puzzles_played, puzzle_date');
  if (from) query = query.gte('puzzle_date', from);

  const { data, error } = await query;
  if (error) {
    console.error('leaderboard query failed', error);
    return json({ error: 'could not load the leaderboard' }, 500);
  }

  const totals = new Map<string, { displayName: string; points: number; played: number }>();
  for (const row of data ?? []) {
    const entry = totals.get(row.display_name) ?? {
      displayName: row.display_name,
      points: 0,
      played: 0,
    };
    entry.points += row.total_points ?? 0;
    entry.played += row.puzzles_played ?? 0;
    totals.set(row.display_name, entry);
  }

  const standings = [...totals.values()]
    .sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName))
    .slice(0, 100)
    .map((entry, index) => ({ rank: index + 1, ...entry }));

  return json({ range, from, to: today, standings });
});
