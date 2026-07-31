/**
 * GET /confirm?token=<uuid> — complete double opt-in.
 *
 * The token is single-use: confirming rotates it, so a leaked link (forwarded
 * email, browser history, mail-scanner prefetch) can't be replayed later.
 */
// @ts-nocheck -- Deno/edge runtime types are not part of the web app's tsconfig.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { renderNoticePage } from '../_shared/server/email.ts';
import { appUrl, html, preflight } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  const token = new URL(req.url).searchParams.get('token') ?? '';
  const invalid = () =>
    html(
      renderNoticePage(
        'That link is no longer valid',
        'It may already have been used or replaced by a newer confirmation email. Subscribe again to get a fresh link.',
        appUrl(),
      ),
      400,
    );

  if (!/^[0-9a-f-]{36}$/i.test(token)) return invalid();

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Match on the token alone and rotate it in the same statement, so a replay
  // finds nothing. `select` confirms a row was actually updated.
  const { data, error } = await admin
    .from('users')
    .update({
      confirmed_at: new Date().toISOString(),
      subscribed: true,
      confirm_token: crypto.randomUUID(),
    })
    .eq('confirm_token', token)
    .select('display_name')
    .maybeSingle();

  if (error) {
    console.error('confirm failed', error);
    return html(
      renderNoticePage('Something went wrong', 'Please try that link again in a moment.'),
      500,
    );
  }
  if (!data) return invalid();

  return html(
    renderNoticePage(
      "You're subscribed!",
      `Thanks ${data.display_name} — five Catan puzzles will land in your inbox each morning.`,
      appUrl(),
    ),
  );
});
