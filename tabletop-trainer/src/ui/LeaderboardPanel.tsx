import { useEffect, useState } from 'react';
import { fetchLeaderboard, LeaderboardRange, Standing } from './api';

const RANGES: { id: LeaderboardRange; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'all', label: 'All time' },
];

/**
 * Public standings. Display names only — emails are the internal key and are
 * never returned by the API, so there is nothing here to leak.
 *
 * Names are user-supplied; React escapes them on render, which is exactly why
 * they must never be injected as HTML.
 */
export function LeaderboardPanel() {
  const [range, setRange] = useState<LeaderboardRange>('today');
  const [standings, setStandings] = useState<Standing[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setStandings(null);
    setError('');
    fetchLeaderboard(range)
      .then((data) => {
        if (!cancelled) setStandings(data.standings);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <section className="leaderboard" id="leaderboard">
      <div className="leaderboard-head">
        <h2>Leaderboard</h2>
        <div className="range-tabs" role="group" aria-label="Leaderboard range">
          {RANGES.map((option) => (
            <button
              key={option.id}
              className={`range-tab${range === option.id ? ' active' : ''}`}
              onClick={() => setRange(option.id)}
              aria-pressed={range === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="leaderboard-note">{error}</p>}
      {!error && standings === null && <p className="leaderboard-note">Loading standings…</p>}
      {!error && standings?.length === 0 && (
        <p className="leaderboard-note">No scores yet — be the first to play today’s set.</p>
      )}

      {!!standings?.length && (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Player</th>
              <th scope="col">Points</th>
              <th scope="col">Puzzles</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={`${row.rank}-${row.displayName}`}>
                <td className="rank">{row.rank}</td>
                <td>{row.displayName}</td>
                <td className="num">{row.points}</td>
                <td className="num">{row.played}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
