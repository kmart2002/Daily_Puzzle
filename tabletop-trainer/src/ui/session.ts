/**
 * Client-side session handling.
 *
 * The token arrives as `?t=` on a link from an email (daily puzzle link or
 * magic sign-in). We stash it in localStorage and strip it from the URL so it
 * doesn't sit in the address bar, get copied into a screenshot, or leak through
 * a `Referer` header.
 *
 * The token is opaque to the browser: it is signed and verified server-side, so
 * nothing here needs to (or can) validate it. Treat it purely as a bearer
 * credential to attach to API calls.
 */
const STORAGE_KEY = 'tt.session-token';

function readTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('t');
  if (!token || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
  return token;
}

/** Removes `t` from the visible URL without reloading or losing other params. */
function stripTokenFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('t')) return;
  url.searchParams.delete('t');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

/** Call once on startup: promotes a link token into stored session state. */
export function captureSessionToken(): void {
  const token = readTokenFromUrl();
  if (token) {
    try {
      window.localStorage.setItem(STORAGE_KEY, token);
    } catch {
      /* private mode / storage disabled — the in-URL token still works for this page */
    }
    stripTokenFromUrl();
  }
}

export function getSessionToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

export function isSignedIn(): boolean {
  return getSessionToken() !== null;
}
