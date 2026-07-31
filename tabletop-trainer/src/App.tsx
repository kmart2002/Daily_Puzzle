import { useMemo, useState } from 'react';
import { EdgeKey } from './engine/catan/board';
import { hints } from './engine/catan/coach';
import { describeVertex, roadCandidates } from './engine/catan/evaluate';
import { createSession, placeUserRoad, placeUserSettlement } from './engine/catan/puzzle';
import { legalVertices } from './engine/catan/rules';
import { VertexKey } from './engine/catan/types';
import { BoardView, Overlay } from './ui/BoardView';
import { CoachPanel } from './ui/CoachPanel';
import { SubscribeCard } from './ui/SubscribeCard';

export const DAILY_SET_SIZE = 5;

function todayStamp(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/**
 * The day's practice set: five seeded puzzles, same for everyone, like a daily
 * crossword page. Puzzle 1 is "the" daily; 2-5 round out a short session.
 */
export function dailySeeds(stamp = todayStamp()): string[] {
  return Array.from({ length: DAILY_SET_SIZE }, (_, i) => `daily-${stamp}-${i + 1}`);
}

function randomSeed(): string {
  return `practice-${Math.random().toString(36).slice(2, 8)}`;
}

/** Deep links (e.g. from the daily email): ?seed=daily-2026-07-22-3 */
function seedFromUrl(): string | null {
  const seed = new URLSearchParams(window.location.search).get('seed');
  return seed && /^[\w-]{1,64}$/.test(seed) ? seed : null;
}

/** Seat colors by index; the user (seat 2) is blue. */
const SEAT_COLORS = ['#dc2626', '#ea580c', '#2563eb', '#f5f5f4'];

const HINT_TONES: Overlay['tone'][] = ['gold', 'silver', 'bronze'];

export default function App() {
  const [seed, setSeed] = useState(() => seedFromUrl() ?? dailySeeds()[0]);
  const [session, setSession] = useState(() => createSession(seedFromUrl() ?? dailySeeds()[0]));
  const [hintsShown, setHintsShown] = useState(false);
  const [focusStep, setFocusStep] = useState<number | null>(null);

  const todaysSeeds = dailySeeds();
  const dailyIndex = todaysSeeds.indexOf(seed); // -1 when on a practice board

  function startPuzzle(newSeed: string) {
    setSeed(newSeed);
    setSession(createSession(newSeed));
    setHintsShown(false);
    setFocusStep(null);
  }

  function handlePlace(vertex: VertexKey) {
    setSession((s) => placeUserSettlement(s, vertex));
    setHintsShown(false);
  }

  function handleRoad(edge: EdgeKey) {
    setSession((s) => placeUserRoad(s, edge));
    setHintsShown(false);
  }

  const legal = useMemo(
    () =>
      session.phase === 'user-settlement'
        ? new Set(legalVertices(session.board, session.placements))
        : new Set<VertexKey>(),
    [session],
  );

  const currentRoadOptions = useMemo(
    () =>
      session.phase === 'user-road' && session.pendingSettlement
        ? roadCandidates(
            session.board, session.placements, session.roads,
            session.userSeat, session.pendingSettlement,
          )
        : [],
    [session],
  );

  const legalEdges = currentRoadOptions.map((c) => ({
    edge: c.edge,
    label: c.target
      ? `Place road toward ${describeVertex(session.board, c.target)}`
      : 'Place road toward the coast',
  }));

  const currentHints = useMemo(
    () =>
      session.phase === 'user-settlement' && hintsShown
        ? hints(session.board, session.placements, session.userSeat, 3)
        : [],
    [session, hintsShown],
  );

  const overlays: Overlay[] = [];
  const edgeOverlays: { edge: EdgeKey; tone: Overlay['tone'] }[] = [];
  if (hintsShown) {
    currentHints.forEach((h, i) => {
      overlays.push({ vertex: h.spot.vertex, label: `#${i + 1}`, tone: HINT_TONES[i] });
    });
    currentRoadOptions.slice(0, 3).forEach((c, i) => {
      if (c.target) overlays.push({ vertex: c.target, label: `#${i + 1}`, tone: HINT_TONES[i] });
    });
  }
  // Spotlight a graded turn: the full podium at decision time — top-3
  // settlement spots (the player's own pick marked ✓) and the best road.
  if (focusStep !== null) {
    const report = session.reports[focusStep - 1];
    const roadReport = session.roadReports[focusStep - 1];
    report?.topPicks.forEach((s, i) => {
      const yours = s.vertex === report.chosen.vertex;
      overlays.push({
        vertex: s.vertex,
        label: yours ? `#${i + 1} ✓ you` : `#${i + 1}`,
        tone: HINT_TONES[i],
      });
    });
    if (report && report.rank > 3) {
      overlays.push({ vertex: report.chosen.vertex, label: `you · #${report.rank}`, tone: 'best' });
    }
    if (roadReport) {
      edgeOverlays.push({ edge: roadReport.best.edge, tone: 'best' });
      if (roadReport.best.target) {
        overlays.push({ vertex: roadReport.best.target, label: 'road target', tone: 'best' });
      }
    }
  }

  const hintLines =
    session.phase === 'user-road'
      ? currentRoadOptions
          .slice(0, 3)
          .map((c, i) =>
            c.target
              ? `#${i + 1} toward ${describeVertex(session.board, c.target)} — expansion value ${c.value.toFixed(1)}`
              : `#${i + 1} toward the coast — no future spot that way`,
          )
      : currentHints.map(
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
            <span className="seed-tag">
              {dailyIndex >= 0 ? `Daily ${dailyIndex + 1} of ${DAILY_SET_SIZE} · ${seed}` : `Practice · ${seed}`}
            </span>
          </p>
        </div>
        <nav>
          <div className="daily-set" role="group" aria-label="Today's five puzzles">
            <span className="daily-label">Today:</span>
            {todaysSeeds.map((s, i) => (
              <button
                key={s}
                className={`daily-pick${s === seed ? ' active' : ''}`}
                onClick={() => startPuzzle(s)}
                aria-label={`Daily puzzle ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button onClick={() => startPuzzle(seed)}>Retry board</button>
          <button onClick={() => startPuzzle(randomSeed())}>Practice board</button>
        </nav>
      </header>

      <main>
        <div className="board-wrap">
          <BoardView
            board={session.board}
            placements={session.placements}
            roads={session.roads}
            legal={legal}
            onVertexClick={handlePlace}
            legalEdges={legalEdges}
            onEdgeClick={handleRoad}
            seatColors={SEAT_COLORS}
            overlays={overlays}
            edgeOverlays={edgeOverlays}
            lastPlaced={lastPlaced}
          />
          <p className="board-hint">
            {session.phase === 'user-settlement' &&
              'Click a highlighted vertex to place your settlement.'}
            {session.phase === 'user-road' &&
              'Now click a dashed edge to place the road that comes with it.'}
            {session.phase === 'done' &&
              'Draft complete — read your coach’s report, then retry or grab a practice board.'}
          </p>
        </div>
        <CoachPanel
          session={session}
          seatColors={SEAT_COLORS}
          hintsShown={hintsShown}
          onToggleHints={() => setHintsShown((v) => !v)}
          hintLines={hintLines}
          focusStep={focusStep}
          onFocusStep={setFocusStep}
        />
      </main>
      <footer className="app-footer">
        <SubscribeCard />
      </footer>
    </div>
  );
}
