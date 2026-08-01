import { describe, expect, it } from 'vitest';
import {
  dailySeeds, normalizeDisplayName, normalizeEmail, signPlayToken, timingSafeEqual, utcDate,
  verifyPlayToken,
} from '../tokens';

const SECRET = 'test-signing-secret';
const payload = { email: 'player@example.com', date: '2026-08-01', exp: Date.now() + 60_000 };

describe('play tokens', () => {
  it('round-trips a signed token', async () => {
    const token = await signPlayToken(payload, SECRET);
    expect(await verifyPlayToken(token, SECRET)).toEqual(payload);
  });

  it('produces URL-safe tokens (no +, /, = or padding)', async () => {
    const token = await signPlayToken(payload, SECRET);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(token)).toBe(token);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signPlayToken(payload, 'other-secret');
    expect(await verifyPlayToken(token, SECRET)).toBeNull();
  });

  it('rejects a tampered payload (cannot swap in another email)', async () => {
    const token = await signPlayToken(payload, SECRET);
    const forgedBody = btoa(JSON.stringify({ ...payload, email: 'attacker@example.com' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const forged = `${forgedBody}.${token.split('.')[1]}`;
    expect(await verifyPlayToken(forged, SECRET)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const expired = { ...payload, exp: Date.now() - 1 };
    const token = await signPlayToken(expired, SECRET);
    expect(await verifyPlayToken(token, SECRET)).toBeNull();
    // ...but was valid before it expired.
    expect(await verifyPlayToken(token, SECRET, expired.exp - 1_000)).toEqual(expired);
  });

  it('rejects malformed tokens instead of throwing', async () => {
    for (const bad of ['', 'nodot', 'a.b.c', 'not-base64!.sig', '.', 'x.']) {
      expect(await verifyPlayToken(bad, SECRET)).toBeNull();
    }
  });
});

describe('normalization', () => {
  it('lowercases and trims valid emails', () => {
    expect(normalizeEmail('  Player@Example.COM ')).toBe('player@example.com');
    expect(normalizeEmail('a.b+tag@sub.example.co.uk')).toBe('a.b+tag@sub.example.co.uk');
  });

  it('rejects non-emails', () => {
    for (const bad of ['', 'nope', 'a@b', 'no@dot', 'two@@at.com', 'sp ace@x.com', null, 42]) {
      expect(normalizeEmail(bad)).toBeNull();
    }
  });

  it('collapses whitespace and strips control characters from display names', () => {
    expect(normalizeDisplayName('  Marty   Kahn ')).toBe('Marty Kahn');
    expect(normalizeDisplayName('Bad\u0000Name\u001f')).toBe('BadName');
    expect(normalizeDisplayName('Line\nBreak')).toBe('Line Break');
  });

  it('rejects empty or over-long display names (DB allows 1-40)', () => {
    expect(normalizeDisplayName('   ')).toBeNull();
    expect(normalizeDisplayName('x'.repeat(41))).toBeNull();
    expect(normalizeDisplayName('x'.repeat(40))).toHaveLength(40);
  });
});

describe('timingSafeEqual', () => {
  it('matches identical strings and rejects any difference', () => {
    expect(timingSafeEqual('correct-horse', 'correct-horse')).toBe(true);
    expect(timingSafeEqual('correct-horse', 'correct-horsE')).toBe(false);
    expect(timingSafeEqual('secret', 'secretsecret')).toBe(false); // length differs
    expect(timingSafeEqual('', '')).toBe(true);
    expect(timingSafeEqual('', 'x')).toBe(false);
  });

  it('handles multi-byte characters without throwing', () => {
    expect(timingSafeEqual('pässwörd', 'pässwörd')).toBe(true);
    expect(timingSafeEqual('pässwörd', 'password')).toBe(false);
  });
});

describe('daily helpers', () => {
  it('derives the five seeds for a date', () => {
    expect(dailySeeds('2026-08-01')).toEqual([
      'daily-2026-08-01-1', 'daily-2026-08-01-2', 'daily-2026-08-01-3',
      'daily-2026-08-01-4', 'daily-2026-08-01-5',
    ]);
  });

  it('uses the UTC calendar date', () => {
    expect(utcDate(new Date('2026-08-01T23:30:00Z'))).toBe('2026-08-01');
    expect(utcDate(new Date('2026-08-02T00:10:00Z'))).toBe('2026-08-02');
  });
});
