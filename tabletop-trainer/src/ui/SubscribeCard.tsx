import { FormEvent, useState } from 'react';

/**
 * Signup for the daily email. Posts to the `subscribe` Edge Function, which
 * sends a confirmation link (double opt-in) — nothing is mailed until the
 * address is confirmed.
 *
 * `VITE_API_URL` is a public functions base URL, not a secret. No key of any
 * kind belongs in this bundle.
 */
const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function SubscribeCard() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (status === 'sending') return;

    if (!API_URL) {
      setStatus('error');
      setMessage('Subscriptions aren’t configured on this build yet.');
      return;
    }

    setStatus('sending');
    try {
      const response = await fetch(`${API_URL}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus('error');
        setMessage(body.error ?? 'That didn’t work. Please try again.');
        return;
      }
      setStatus('sent');
      setMessage(body.message ?? 'Check your inbox to confirm.');
    } catch {
      setStatus('error');
      setMessage('Couldn’t reach the server. Please try again.');
    }
  }

  if (status === 'sent') {
    return (
      <section className="subscribe-card" aria-live="polite">
        <h2>Almost there</h2>
        <p className="subscribe-note">{message}</p>
      </section>
    );
  }

  return (
    <section className="subscribe-card">
      <h2>Get five puzzles every morning</h2>
      <p className="subscribe-note">
        Same boards for everyone, coached and graded. Free, one email a day, unsubscribe anytime.
      </p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="sub-name">Display name</label>
        <input
          id="sub-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Shown on the leaderboard"
          maxLength={40}
          required
        />
        <label htmlFor="sub-email">Email</label>
        <input
          id="sub-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Subscribe'}
        </button>
        {status === 'error' && (
          <p className="subscribe-error" role="alert">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
