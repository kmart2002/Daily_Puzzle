/**
 * Shared HTTP/mail plumbing for the Edge Functions. IO only — all pure logic
 * lives in `_shared/server/` (copied from tabletop-trainer/src/server) so it
 * stays unit-tested.
 */
// @ts-nocheck -- Deno/edge runtime types are not part of the web app's tsconfig.

/** Browsers post to these functions from the static site, so CORS is required. */
export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

export const html = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
  });

export const preflight = () => new Response(null, { status: 204, headers: corsHeaders });

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  /** Adds List-Unsubscribe headers so Gmail/Yahoo show a native unsubscribe. */
  unsubscribeUrl?: string;
}

/**
 * Sends through Resend. Errors are thrown so callers can decide whether one
 * bad address should fail an entire batch (it shouldn't).
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM') ?? 'Tabletop Trainer <puzzles@example.com>';
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const headers: Record<string, string> = {};
  if (message.unsubscribeUrl) {
    // RFC 8058 one-click unsubscribe — required for bulk senders.
    headers['List-Unsubscribe'] = `<${message.unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      headers,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend ${response.status}: ${await response.text()}`);
  }
}

/** Absolute base URL of these functions, used to build confirm/unsubscribe links. */
export function functionsBaseUrl(): string {
  const explicit = Deno.env.get('PUBLIC_FUNCTIONS_URL');
  if (explicit) return explicit.replace(/\/+$/, '');
  return `${Deno.env.get('SUPABASE_URL')!.replace(/\/+$/, '')}/functions/v1`;
}

/** Where the playable app lives (target of the emailed puzzle links). */
export function appUrl(): string {
  const url = Deno.env.get('PUBLIC_APP_URL')
    ?? 'https://kmart2002.github.io/Daily_Puzzle/tabletop-trainer/';
  return url.replace(/\/?$/, '/');
}

export function senderAddress(): string {
  return Deno.env.get('MAIL_SENDER_ADDRESS') ?? 'Tabletop Trainer';
}
