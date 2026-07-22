import { edgeEndpoints } from '../engine/catan/board';
import { CoachReport, Grade, RoadReport } from '../engine/catan/coach';
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

function RoadReportCard({ report, board }: { report: RoadReport; board: PuzzleSession['board'] }) {
  return (
    <div className="report-card road-report">
      <div className="report-head">
        <GradeBadge grade={report.grade} />
        <div>
          <div className="report-title">
            Road #{report.step} — ranked #{report.rank} of {report.outOf}
          </div>
          <div className="report-headline">{report.headline}</div>
        </div>
      </div>
      <ul>
        {report.details.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
      {report.rank !== 1 && report.best.target && (
        <div className="alt-line">
          Best road aimed at <strong>{describeVertex(board, report.best.target)}</strong>
        </div>
      )}
    </div>
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
  const { board, seats, log, reports, roadReports, phase } = session;
  const step = phase === 'user-road' ? reports.length : reports.length + 1;

  const roadToward = (vertex: string, edge: string) => {
    const toward = edgeEndpoints(edge).find((v) => v !== vertex)!;
    return describeVertex(board, toward);
  };

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
              <span>
                {seats[move.player].name} → {describeVertex(board, move.vertex)}
                <span className="road-note"> · road toward {roadToward(move.vertex, move.road)}</span>
              </span>
            </li>
          ))}
          {phase !== 'done' && (
            <li className="your-turn">
              <span className="seat-swatch" style={{ background: seatColors[session.userSeat] }} />
              <strong>
                {phase === 'user-settlement'
                  ? `Your turn — place settlement #${step}`
                  : `Now place the road for settlement #${step}`}
              </strong>
            </li>
          )}
        </ol>
        {phase !== 'done' && (
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
          {reports.map((r, i) => (
            <div key={r.step}>
              <ReportCard report={r} board={board} />
              {roadReports[i] && <RoadReportCard report={roadReports[i]} board={board} />}
            </div>
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
