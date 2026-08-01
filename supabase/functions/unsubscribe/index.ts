/**
 * /unsubscribe?token=<uuid> — stop the daily email.
 *
 *   GET  → renders a confirmation page. Deliberately makes NO change: mail
 *          scanners and link-preview bots fetch every URL in an email, so an
 *          unsubscribing GET would silently drop subscribers who never clicked.
 *   POST → performs the unsubscribe. Also the verb Gmail/Yahoo use for RFC 8058
 *          one-click (List-Unsubscribe-Post), which bots do not send.
 *
 * The token is NOT rotated — unsubscribing must stay idempotent, so submitting
 * an old link twice is harmless rather than an error.
 */
// @ts-nocheck -- Deno/edge runtime types are not part of the web app's tsconfig.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { renderNoticePage, renderUnsubscribeConfirmPage } from '../_shared/server/email.ts';
import { functionsBaseUrl, html, preflight } from '../_shared/http.ts';

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

  // A GET never mutates — it only offers the button that POSTs.
  if (req.method === 'GET') {
    return html(renderUnsubscribeConfirmPage(`${functionsBaseUrl()}/unsubscribe?token=${token}`));
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // RFC 8058 one-click posts `List-Unsubscribe=One-Click`; our own confirmation
  // form does not. Read it before the DB call so the response shape is decided
  // even if the body is unreadable.
  const rawBody = await req.text().catch(() => '');
  const isOneClick = rawBody.includes('List-Unsubscribe=One-Click');

  const { error } = await admin
    .from('users')
    .update({ subscribed: false })
    .eq('unsubscribe_token', token);

  if (error) {
    console.error('unsubscribe failed', error);
    return html(renderNoticePage('Something went wrong', 'Please try that link again.'), 500);
  }

  // Mail clients ignore the body; a person needs confirmation they can see.
  if (isOneClick) return new Response(null, { status: 200 });

  return html(
    renderNoticePage(
      'Unsubscribed',
      'You will not receive any more daily puzzle emails. You can subscribe again any time.',
    ),
  );
});
