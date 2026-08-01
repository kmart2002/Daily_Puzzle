/**
 * POST /send-daily — mail every confirmed subscriber the day's five puzzles.
 * Invoked by a scheduled job; protected by a shared CRON_SECRET header.
 *
 * Idempotent by construction: for each recipient we first INSERT a claim row
 * into `daily_sends` and only mail the rows the insert actually created. A
 * retried, double-fired, or half-crashed run therefore never sends anyone a
 * second copy — the primary key is the lock.
 *
 * Each recipient's links carry a short-lived HMAC token binding {email, date},
 * so clicking through from the inbox authenticates that player for that day
 * without a password and without storing five rows per user per day.
 */
// @ts-nocheck -- Deno/edge runtime types are not part of the web app's tsconfig.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dailySeeds, signPlayToken, utcDate } from '../_shared/server/tokens.ts';
import { dailyEmailSubject, renderDailyEmail } from '../_shared/server/email.ts';
import {
  appUrl, functionsBaseUrl, json, senderAddress, sendMail, timingSafeEqual,
} from '../_shared/http.ts';

/** Play tokens outlive the puzzle day a little, for late-evening players. */
const TOKEN_TTL_MS = 36 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const expectedSecret = Deno.env.get('CRON_SECRET');
  if (!expectedSecret || !timingSafeEqual(req.headers.get('x-cron-secret') ?? '', expectedSecret)) {
    return json({ error: 'forbidden' }, 403);
  }

  const signingSecret = Deno.env.get('PLAY_TOKEN_SECRET');
  if (!signingSecret) return json({ error: 'PLAY_TOKEN_SECRET is not configured' }, 500);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const puzzleDate = utcDate();
  const seeds = dailySeeds(puzzleDate);

  // Record the day's seeds once, so scoring can be audited against history.
  await admin.from('daily_sets').upsert({ puzzle_date: puzzleDate, seeds }, { onConflict: 'puzzle_date' });

  const { data: recipients, error } = await admin
    .from('users')
    .select('email, display_name, unsubscribe_token')
    .eq('subscribed', true)
    .not('confirmed_at', 'is', null);

  if (error) {
    console.error('recipient query failed', error);
    return json({ error: 'could not load recipients' }, 500);
  }

  const expiry = Date.now() + TOKEN_TTL_MS;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of recipients ?? []) {
    // Claim first. A conflict means this address was already mailed today.
    const { data: claim, error: claimError } = await admin
      .from('daily_sends')
      .upsert({ puzzle_date: puzzleDate, email: user.email }, {
        onConflict: 'puzzle_date,email',
        ignoreDuplicates: true,
      })
      .select('email');

    if (claimError) {
      console.error('claim failed for a recipient', claimError); // no PII in logs
      failed++;
      continue;
    }
    if (!claim || claim.length === 0) {
      skipped++; // already sent today
      continue;
    }

    try {
      const token = await signPlayToken({ email: user.email, date: puzzleDate, exp: expiry }, signingSecret);
      const unsubscribeUrl = `${functionsBaseUrl()}/unsubscribe?token=${user.unsubscribe_token}`;

      await sendMail({
        to: user.email,
        subject: dailyEmailSubject(puzzleDate),
        unsubscribeUrl,
        html: renderDailyEmail({
          displayName: user.display_name,
          puzzleDate,
          puzzleUrls: seeds.map(
            (seed) => `${appUrl()}?seed=${encodeURIComponent(seed)}&t=${encodeURIComponent(token)}`,
          ),
          unsubscribeUrl,
          leaderboardUrl: `${appUrl()}#leaderboard`,
          senderAddress: senderAddress(),
        }),
      });
      sent++;
    } catch (sendError) {
      // Release the claim so the next run retries this recipient.
      console.error('send failed for a recipient', sendError); // no PII in logs
      await admin.from('daily_sends').delete().eq('puzzle_date', puzzleDate).eq('email', user.email);
      failed++;
    }
  }

  return json({ puzzleDate, sent, skipped, failed });
});
