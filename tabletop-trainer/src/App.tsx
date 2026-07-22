import { useMemo, useState } from 'react';
import { hints } from './engine/catan/coach';
import { describeVertex } from './engine/catan/evaluate';
import { createSession, placeUser } from './engine/catan/puzzle';
import { legalVertices } from './engine/catan/rules';
import { VertexKey } from './engine/catan/types';
import { BoardView, Overlay } from './ui/BoardView';
import { CoachPanel } from './ui/CoachPanel';

/** Same board for everyone each day, like a daily crossword. */
function dailySeed(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `daily-${now.getFullYear()}-${m}-${d}`;
}

function randomSeed(): string {
  return `practice-${Math.random().toString(36).slice(2, 8)}`;
}

/** Seat colors by index; the user (seat 2) is blue. */
const SEAT_COLORS = ['#dc2626', '#ea580c', '#2563eb', '#f5f5f4'];

const HINT_TONES: Overlay['tone'][] = ['gold', 'silver', 'bronze'];

export default function App() {
  const [seed, setSeed] = useState(dailySeed);
  const [session, setSession] = useState(() => createSession(dailySeed()));
  const [hintsShown, setHintsShown] = useState(false);
  const [showBest, setShowBest] = useState(false);

  const isDaily = seed === dailySeed();

  function startPuzzle(newSeed: string) {
    setSeed(newSeed);
    setSession(createSession(newSeed));
    setHintsShown(false);
    setShowBest(false);
  }

  function handlePlace(vertex: VertexKey) {
    setSession((s) => placeUser(s, vertex));
    setHintsShown(false);
  }

  const legal = useMemo(
    () =>
      session.phase === 'user-turn'
        ? new Set(legalVertices(session.board, session.placements))
        : new Set<VertexKey>(),
    [session],
  );

  const currentHints = useMemo(
    () =>
      session.phase === 'user-turn' && hintsShown
        ? hints(session.board, session.placements, session.userSeat, 3)
        : [],
    [session, hintsShown],
  );

  const overlays: Overlay[] = [];
  if (hintsShown) {
    currentHints.forEach((h, i) => {
      overlays.push({ vertex: h.spot.vertex, label: `#${i + 1}`, tone: HINT_TONES[i] });
    });
  }
  if (showBest && session.phase === 'done') {
    for (const report of session.reports) {
      if (report.rank !== 1) {
        overlays.push({ vertex: report.best.vertex, label: `best #${report.step}`, tone: 'best' });
      }
    }
  }

  const hintLines = currentHints.map(
    (h, i) => `#${i + 1} ${describeVertex(session.board, h.spot.vertex)} — ${h.reason}`,
  );

  const lastPlaced = session.log.length > 0 ? session.log[session.log.length - 1].vertex : null;

  return (
    <div className="app">
      <header>
        <div>
          <h1>Tabletop Trainer</h1>
          <p className="subtitle">
            Daily Catan puzzle — pick the best starting settlements.{' '}
            <span className="seed-tag">{isDaily ? `Daily · ${seed}` : `Practice · ${seed}`}</span>
          </p>
        </div>
        <nav>
          <button onClick={() => startPuzzle(dailySeed())}>Today&rsquo;s puzzle</button>
          <button onClick={() => startPuzzle(seed)}>Retry board</button>
          <button onClick={() => startPuzzle(randomSeed())}>Practice board</button>
        </nav>
      </header>

      <main>
        <div className="board-wrap">
          <BoardView
            board={session.board}
            placements={session.placements}
            legal={legal}
            onVertexClick={handlePlace}
            seatColors={SEAT_COLORS}
            overlays={overlays}
            lastPlaced={lastPlaced}
          />
          <p className="board-hint">
            {session.phase === 'user-turn'
              ? 'Click a highlighted vertex to place your settlement.'
              : 'Draft complete — read your coach’s report, then retry or grab a practice board.'}
          </p>
        </div>
        <CoachPanel
          session={session}
          seatColors={SEAT_COLORS}
          hintsShown={hintsShown}
          onToggleHints={() => setHintsShown((v) => !v)}
          hintLines={hintLines}
          showBest={showBest}
          onToggleBest={() => setShowBest((v) => !v)}
        />
      </main>
    </div>
  );
}
