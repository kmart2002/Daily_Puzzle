import { CoachReport, Grade } from '../engine/catan/coach';
import { describeVertex } from '../engine/catan/evaluate';
import { PuzzleSession } from '../engine/catan/puzzle';

const GRADE_COLORS: Record<Grade, string> = {
  S: '#16a34a',
  A: '#65a30d',
  B: '#ca8a04',
  C: '#ea580c',
  D: '#dc2626',
};

interface CoachPanelProps {
  session: PuzzleSession;
  seatColors: string[];
  hintsShown: boolean;
  onToggleHints: () => void;
  hintLines: string[];
  showBest: boolean;
  onToggleBest: () => void;
}

function GradeBadge({ grade }: { grade: Grade }) {
  return (
    <span className="grade-badge" style={{ background: GRADE_COLORS[grade] }}>
      {grade}
    </span>
  );
}

function ReportCard({ report, board }: { report: CoachReport; board: PuzzleSession['board'] }) {
  return (
    <div className="report-card">
      <div className="report-head">
        <GradeBadge grade={report.grade} />
        <div>
          <div className="report-title">
            Settlement #{report.step} — ranked #{report.rank} of {report.outOf}
          </div>
          <div className="report-headline">{report.headline}</div>
        </div>
      </div>
      <ul>
        {report.details.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
      {report.rank !== 1 && (
        <div className="alt-line">
          Best was <strong>{describeVertex(board, report.best.vertex)}</strong>
        </div>
      )}
    </div>
  );
}

export function CoachPanel({
  session, seatColors, hintsShown, onToggleHints, hintLines, showBest, onToggleBest,
}: CoachPanelProps) {
  const { board, seats, log, reports, phase } = session;
  const step = reports.length + 1;

  return (
    <aside className="coach-panel">
      <section>
        <h2>Table</h2>
        <ul className="seat-list">
          {seats.map((seat) => (
            <li key={seat.index}>
              <span className="seat-swatch" style={{ background: seatColors[seat.index] }} />
              <strong>{seat.name}</strong>
              <span className="seat-tagline">{seat.tagline}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Draft log</h2>
        <ol className="draft-log">
          {log.map((move, i) => (
            <li key={i}>
              <span className="seat-swatch" style={{ background: seatColors[move.player] }} />
              {seats[move.player].name} → {describeVertex(board, move.vertex)}
            </li>
          ))}
          {phase === 'user-turn' && (
            <li className="your-turn">
              <span className="seat-swatch" style={{ background: seatColors[session.userSeat] }} />
              <strong>Your turn — place settlement #{step}</strong>
            </li>
          )}
        </ol>
        {phase === 'user-turn' && (
          <div className="hint-block">
            <button onClick={onToggleHints}>{hintsShown ? 'Hide hints' : 'Coach, give me a hint'}</button>
            {hintsShown && (
              <ol className="hint-list">
                {hintLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            )}
          </div>
        )}
      </section>

      {reports.length > 0 && (
        <section>
          <h2>Coach&rsquo;s report</h2>
          {reports.map((r) => (
            <ReportCard key={r.step} report={r} board={board} />
          ))}
          {phase === 'done' && (
            <button onClick={onToggleBest}>
              {showBest ? 'Hide best spots' : 'Show best spots on board'}
            </button>
          )}
        </section>
      )}
    </aside>
  );
}
