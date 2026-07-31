/**
 * /unsubscribe?token=<uuid> — stop the daily email.
 *
 * Handles GET (someone clicking the footer link) and POST (Gmail/Yahoo one-click
 * via the List-Unsubscribe-Post header, RFC 8058). Both must work: bulk senders
 * are required to honour one-click, and it is never allowed to ask the user to
 * log in first.
 *
 * The token is NOT rotated — unsubscribing must stay idempotent, so clicking an
 * old link twice is harmless rather than an error.
 */
// @ts-nocheck -- Deno/edge runtime types are not part of the web app's tsconfig.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { renderNoticePage } from '../_shared/server/email.ts';
import { html, preflight } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return html(renderNoticePage('Unsupported request', 'Use the link from your email.'), 405);
  }

  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return html(
      renderNoticePage('That unsubscribe link looks wrong', 'Please use the link in a recent email.'),
      400,
    );
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error } = await admin
    .from('users')
    .update({ subscribed: false })
    .eq('unsubscribe_token', token);

  if (error) {
    console.error('unsubscribe failed', error);
    return html(renderNoticePage('Something went wrong', 'Please try that link again.'), 500);
  }

  // One-click clients want a plain 200 and ignore the body.
  if (req.method === 'POST') return new Response(null, { status: 200 });

  return html(
    renderNoticePage(
      'Unsubscribed',
      'You will not receive any more daily puzzle emails. You can subscribe again any time.',
    ),
  );
});
