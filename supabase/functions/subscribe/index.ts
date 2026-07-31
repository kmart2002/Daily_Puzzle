/**
 * POST /subscribe — start a double opt-in subscription.
 *
 * Body: { email, displayName }
 *
 * Privacy: the response is IDENTICAL whether or not the address is already
 * registered. Returning "already subscribed" would turn this endpoint into an
 * email-enumeration oracle, letting anyone test which addresses have accounts.
 *
 * Nothing is mailed to a confirmed subscriber, so this endpoint also can't be
 * used to spam a third party repeatedly — plus a per-day attempt cap.
 */
// @ts-nocheck -- Deno/edge runtime types are not part of the web app's tsconfig.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeDisplayName, normalizeEmail } from '../_shared/server/tokens.ts';
import { CONFIRM_SUBJECT, renderConfirmEmail } from '../_shared/server/email.ts';
import { functionsBaseUrl, json, preflight, sendMail, senderAddress } from '../_shared/http.ts';

const MAX_ATTEMPTS_PER_DAY = 5;

/** Same body for every outcome — see the enumeration note above. */
const GENERIC_OK = {
  ok: true,
  message: 'Check your inbox — if that address can be subscribed, a confirmation link is on its way.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: { email?: unknown; displayName?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const email = normalizeEmail(body.email);
  const displayName = normalizeDisplayName(body.displayName);
  // Shape errors are safe to report: they say nothing about who is registered.
  if (!email) return json({ error: 'Enter a valid email address.' }, 400);
  if (!displayName) return json({ error: 'Enter a display name (1-40 characters).' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // --- Rate limit per address per day ---
  const { data: attempt } = await admin
    .from('subscribe_attempts')
    .select('attempts')
    .eq('email', email)
    .eq('attempted_on', new Date().toISOString().slice(0, 10))
    .maybeSingle();
  if ((attempt?.attempts ?? 0) >= MAX_ATTEMPTS_PER_DAY) return json(GENERIC_OK);
  await admin.rpc('bump_subscribe_attempt', { p_email: email }).catch(() => undefined);

  const { data: existing } = await admin
    .from('users')
    .select('email, confirmed_at, subscribed')
    .eq('email', email)
    .maybeSingle();

  // Already active: send nothing, but answer exactly as we do for new signups.
  if (existing?.confirmed_at && existing.subscribed) return json(GENERIC_OK);

  // New, unconfirmed, or previously unsubscribed → (re-)issue a confirmation.
  // Re-confirming after an unsubscribe is deliberate: consent must be current.
  const { data: upserted, error } = await admin
    .from('users')
    .upsert(
      {
        email,
        display_name: displayName,
        subscribed: true,
        confirmed_at: null,
        confirm_token: crypto.randomUUID(),
      },
      { onConflict: 'email' },
    )
    .select('confirm_token')
    .single();

  if (error || !upserted) {
    console.error('subscribe upsert failed', error);
    return json({ error: 'Could not process that signup. Try again shortly.' }, 500);
  }

  try {
    await sendMail({
      to: email,
      subject: CONFIRM_SUBJECT,
      html: renderConfirmEmail({
        displayName,
        confirmUrl: `${functionsBaseUrl()}/confirm?token=${upserted.confirm_token}`,
        senderAddress: senderAddress(),
      }),
    });
  } catch (mailError) {
    // Don't leak delivery detail to the caller; the row stays unconfirmed.
    console.error('confirmation send failed', mailError);
  }

  return json(GENERIC_OK);
});
