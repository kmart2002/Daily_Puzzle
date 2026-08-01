/**
 * Thin client for the Edge Functions. `VITE_API_URL` is a public base URL, not
 * a secret — no key of any kind belongs in this bundle.
 */
import { getSessionToken } from './session';

export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export const apiConfigured = API_URL.length > 0;

export interface Standing {
  rank: number;
  displayName: string;
  points: number;
  played: number;
}

export type LeaderboardRange = 'today' | 'week' | 'all';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiConfigured) throw new Error('The leaderboard isn’t configured on this build yet.');
  const response = await fetch(`${API_URL}${path}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error ?? 'Request failed.');
  return body as T;
}

export function fetchLeaderboard(range: LeaderboardRange) {
  return request<{ range: LeaderboardRange; standings: Standing[] }>(`/leaderboard?range=${range}`);
}

export interface SubmittedScore {
  points: number;
  maxPoints: number;
  grade: string;
}

/**
 * Sends the moves the player made — never a score. The server replays them
 * through the same engine and decides the points itself.
 */
export function submitScore(input: {
  seed: string;
  puzzleIndex: number;
  turns: { settlement: string; road: string }[];
}) {
  const token = getSessionToken();
  if (!token) throw new Error('Open today’s link from your email to record a score.');
  return request<SubmittedScore>('/submit-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export function requestMagicLink(email: string) {
  return request<{ message: string }>('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}
