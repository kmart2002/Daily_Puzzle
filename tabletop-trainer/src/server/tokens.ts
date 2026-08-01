/**
 * Pure identity/token helpers shared by the web app and the Supabase Edge
 * Functions. No I/O, no framework — uses only Web Crypto and TextEncoder, which
 * exist in Deno, Node 18+, and browsers alike, so the same source runs on both
 * sides and is unit-testable with Vitest.
 *
 * Two token kinds, on purpose:
 *   • confirm / unsubscribe → opaque UUIDs stored in Postgres (permanent,
 *     revocable, single-use). Handled by the DB, not this module.
 *   • daily play links → stateless HMAC tokens created here. Five per user per
 *     day would be wasteful to persist, and they should expire on their own.
 */

export interface PlayTokenPayload {
  /** Normalized subscriber email this token authenticates. */
  email: string;
  /** UTC puzzle date (YYYY-MM-DD) the token is valid for. */
  date: string;
  /** Expiry, epoch milliseconds. */
  exp: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padding = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding);
  // Explicit ArrayBuffer backing: crypto.subtle wants a non-shared BufferSource.
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** `<base64url(payload)>.<base64url(hmac)>` — compact and URL-safe. */
export async function signPlayToken(payload: PlayTokenPayload, secret: string): Promise<string> {
  if (!secret) throw new Error('signing secret is required');
  const body = base64urlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body));
  return `${body}.${base64urlEncode(new Uint8Array(signature))}`;
}

/**
 * Returns the payload only for a token whose signature verifies and whose
 * expiry is still in the future; otherwise null. Verification goes through
 * `crypto.subtle.verify`, which compares in constant time — never hand-roll
 * the comparison, since a byte-by-byte check leaks the signature by timing.
 */
export async function verifyPlayToken(
  token: string,
  secret: string,
  nowMs: number = Date.now(),
): Promise<PlayTokenPayload | null> {
  if (!secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      base64urlDecode(signature),
      encoder.encode(body),
    );
  } catch {
    return null; // malformed base64 in the signature segment
  }
  if (!valid) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(decoder.decode(base64urlDecode(body)));
  } catch {
    return null;
  }
  const candidate = payload as Partial<PlayTokenPayload> | null;
  if (
    !candidate ||
    typeof candidate.email !== 'string' ||
    typeof candidate.date !== 'string' ||
    typeof candidate.exp !== 'number'
  ) {
    return null;
  }
  if (nowMs > candidate.exp) return null;
  return candidate as PlayTokenPayload;
}

/**
 * Lowercased, trimmed address, or null when it isn't plausibly an email.
 * Deliberately permissive — the confirmation email is the real proof of
 * ownership, so over-strict regexes only reject valid exotic addresses.
 */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email) ? email : null;
}

/** Collapses whitespace and strips control characters; null if unusable. */
export function normalizeDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  // Strip control characters but keep tab/newline/CR, so they collapse into a
  // space below — deleting them outright would weld separate words together.
  const name = raw
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (name.length < 1 || name.length > 40) return null;
  return name;
}

/**
 * Length-independent comparison for shared secrets. `===` on strings short-
 * circuits at the first differing byte, which leaks a secret one character at a
 * time to anyone who can measure response time. Use this for any attacker-
 * supplied value compared against a secret (cron headers, API keys).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

/** The five seeds for a UTC date. Mailer and grader must agree on this. */
export function dailySeeds(date: string): string[] {
  return Array.from({ length: 5 }, (_, i) => `daily-${date}-${i + 1}`);
}

/** UTC calendar date (YYYY-MM-DD) — the puzzle day boundary. */
export function utcDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
