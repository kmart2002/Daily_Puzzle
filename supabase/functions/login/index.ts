/**
 * POST /login — email a magic sign-in link.
 *
 * Identity here is the same HMAC token used by the daily email links, minted
 * with scope 'session' and a longer life. There is no password anywhere in the
 * system, so there is no password to leak, reset, or reuse.
 *
 * Like /subscribe, the response is IDENTICAL for known and unknown addresses —
 * otherwise this becomes an oracle for testing who has an account.
 */
// @ts-nocheck -- Deno/edge runtime types are not part of the web app's tsconfig.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeEmail, signPlayToken, utcDate } from '../_shared/server/tokens.ts';
import { renderMagicLinkEmail, MAGIC_LINK_SUBJECT } from '../_shared/server/email.ts';
import { appUrl, json, preflight, sendMail, senderAddress } from '../_shared/http.ts';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_ATTEMPTS_PER_DAY = 10;

const GENERIC_OK = {
  ok: true,
  message: 'If that address has an account, a sign-in link is on its way.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const signingSecret = Deno.env.get('PLAY_TOKEN_SECRET');
  if (!signingSecret) return json({ error: 'server not configured' }, 500);

  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const email = normalizeEmail(body.email);
  if (!email) return json({ error: 'Enter a valid email address.' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Reuse the signup counter: caps how often any address can be mailed a link.
  const { data: attempts, error: attemptError } = await admin.rpc('bump_subscribe_attempt', {
    p_email: email,
  });
  if (attemptError) {
    console.error('rate-limit check failed', attemptError);
    return json({ error: 'Could not process that request. Try again shortly.' }, 500);
  }
  if (typeof attempts === 'number' && attempts > MAX_ATTEMPTS_PER_DAY) return json(GENERIC_OK);

  const { data: user } = await admin
    .from('users')
    .select('display_name, confirmed_at')
    .eq('email', email)
    .maybeSingle();

  // Unknown or unconfirmed address: say nothing different, send nothing.
  if (!user?.confirmed_at) return json(GENERIC_OK);

  try {
    const token = await signPlayToken(
      { email, date: utcDate(), exp: Date.now() + SESSION_TTL_MS, scope: 'session' },
      signingSecret,
    );
    await sendMail({
      to: email,
      subject: MAGIC_LINK_SUBJECT,
      html: renderMagicLinkEmail({
        displayName: user.display_name,
        signInUrl: `${appUrl()}?t=${encodeURIComponent(token)}`,
        senderAddress: senderAddress(),
      }),
    });
  } catch (mailError) {
    console.error('magic link send failed', mailError);
  }

  return json(GENERIC_OK);
});
