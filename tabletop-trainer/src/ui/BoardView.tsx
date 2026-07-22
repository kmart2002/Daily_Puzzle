import { EdgeKey, edgeEndpoints, hexCorners, parseVertexKey, vertexPos } from '../engine/catan/board';
import { describeVertex } from '../engine/catan/evaluate';
import { Board, PIPS, Placement, Road, TileType, VertexKey } from '../engine/catan/types';

const SIZE = 46;
const PAD = 78;

const TILE_COLORS: Record<TileType, string> = {
  brick: '#c1613c',
  lumber: '#3d7a44',
  ore: '#8b95a1',
  grain: '#e6b93f',
  wool: '#a9cf72',
  desert: '#e3d5ab',
};

const TILE_LABELS: Record<TileType, string> = {
  brick: '🧱',
  lumber: '🌲',
  ore: '⛰️',
  grain: '🌾',
  wool: '🐑',
  desert: '🏜️',
};

export interface Overlay {
  vertex: VertexKey;
  label: string;
  tone: 'gold' | 'silver' | 'bronze' | 'best';
}

interface BoardViewProps {
  board: Board;
  placements: Placement[];
  roads: Road[];
  /** Vertices the user may click right now (empty when it isn't their turn). */
  legal: Set<VertexKey>;
  onVertexClick: (vertex: VertexKey) => void;
  /** Road choices for the just-placed settlement (empty outside the road phase). */
  legalEdges: { edge: EdgeKey; label: string }[];
  onEdgeClick: (edge: EdgeKey) => void;
  seatColors: string[];
  overlays?: Overlay[];
  lastPlaced?: VertexKey | null;
}

/** Trim a segment at both ends so roads don't overlap settlement houses. */
function trimmed(a: { x: number; y: number }, b: { x: number; y: number }, t = 0.18) {
  return {
    x1: a.x + (b.x - a.x) * t,
    y1: a.y + (b.y - a.y) * t,
    x2: b.x - (b.x - a.x) * t,
    y2: b.y - (b.y - a.y) * t,
  };
}

const OVERLAY_COLORS: Record<Overlay['tone'], string> = {
  gold: '#f2b705',
  silver: '#b8c0cc',
  bronze: '#cd8a4f',
  best: '#16a34a',
};

export function BoardView({
  board, placements, roads, legal, onVertexClick, legalEdges, onEdgeClick,
  seatColors, overlays = [], lastPlaced,
}: BoardViewProps) {
  const positions = new Map(
    board.vertexKeys.map((k) => [k, vertexPos(parseVertexKey(k), SIZE)]),
  );
  const xs = [...positions.values()].map((p) => p.x);
  const ys = [...positions.values()].map((p) => p.y);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const width = Math.max(...xs) - Math.min(...xs) + PAD * 2;
  const height = Math.max(...ys) - Math.min(...ys) + PAD * 2;

  return (
    <svg
      className="board"
      viewBox={`${minX} ${minY} ${width} ${height}`}
      role="img"
      aria-label="Catan board"
    >
      {/* Tiles */}
      {board.hexes.map((hex) => {
        const corners = hexCorners(hex.q, hex.r).map((c) => vertexPos(c, SIZE));
        const points = corners.map((p) => `${p.x},${p.y}`).join(' ');
        const cx = corners.reduce((s, p) => s + p.x, 0) / 6;
        const cy = corners.reduce((s, p) => s + p.y, 0) / 6;
        const token = hex.token;
        const red = token === 6 || token === 8;
        return (
          <g key={`${hex.q},${hex.r}`}>
            <polygon points={points} fill={TILE_COLORS[hex.tile]} stroke="#f7efd8" strokeWidth={3} />
            <text x={cx} y={cy - 22} textAnchor="middle" fontSize={13}>
              {TILE_LABELS[hex.tile]}
            </text>
            {token !== null && (
              <g>
                <circle cx={cx} cy={cy + 4} r={15.5} fill="#faf3df" stroke="#00000030" />
                <text
                  x={cx}
                  y={cy + 9}
                  textAnchor="middle"
                  fontSize={red ? 16 : 14}
                  fontWeight={700}
                  fill={red ? '#c0392b' : '#33302a'}
                >
                  {token}
                </text>
                <g fill={red ? '#c0392b' : '#33302a'}>
                  {Array.from({ length: PIPS[token] }, (_, i) => (
                    <circle
                      key={i}
                      cx={cx + (i - (PIPS[token] - 1) / 2) * 4}
                      cy={cy + 14.5}
                      r={1.3}
                    />
                  ))}
                </g>
              </g>
            )}
          </g>
        );
      })}

      {/* Ports */}
      {board.ports.map((port, i) => {
        const a = positions.get(port.vertices[0])!;
        const b = positions.get(port.vertices[1])!;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const len = Math.hypot(mx, my) || 1;
        const ox = mx + (mx / len) * 34;
        const oy = my + (my / len) * 34;
        const label = port.kind === 'any' ? '3:1' : `2:1${TILE_LABELS[port.kind]}`;
        return (
          <g key={i} className="port">
            <line x1={a.x} y1={a.y} x2={ox} y2={oy} stroke="#7a5b3a" strokeWidth={2} strokeDasharray="3 3" />
            <line x1={b.x} y1={b.y} x2={ox} y2={oy} stroke="#7a5b3a" strokeWidth={2} strokeDasharray="3 3" />
            <circle cx={ox} cy={oy} r={14} fill="#f7efd8" stroke="#7a5b3a" strokeWidth={1.5} />
            <text x={ox} y={oy + 4} textAnchor="middle" fontSize={port.kind === 'any' ? 11 : 9} fontWeight={700} fill="#5b4426">
              {label}
            </text>
          </g>
        );
      })}

      {/* Roads */}
      {roads.map((road) => {
        const [ka, kb] = edgeEndpoints(road.edge);
        const seg = trimmed(positions.get(ka)!, positions.get(kb)!);
        return (
          <g key={`r-${road.edge}`}>
            <line {...seg} stroke="#1f2937" strokeWidth={9} strokeLinecap="round" />
            <line {...seg} stroke={seatColors[road.player]} strokeWidth={5.5} strokeLinecap="round" />
          </g>
        );
      })}

      {/* Legal road choices for the pending settlement */}
      {legalEdges.map(({ edge, label }) => {
        const [ka, kb] = edgeEndpoints(edge);
        const seg = trimmed(positions.get(ka)!, positions.get(kb)!, 0.14);
        return (
          <g
            key={`le-${edge}`}
            className="legal-edge"
            role="button"
            tabIndex={0}
            aria-label={label}
            onClick={() => onEdgeClick(edge)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onEdgeClick(edge);
            }}
          >
            <line {...seg} stroke="#ffffff00" strokeWidth={16} strokeLinecap="round" />
            <line
              className="legal-edge-line"
              {...seg}
              stroke="#2563eb"
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray="7 5"
            />
          </g>
        );
      })}

      {/* Overlays (hints / best-spot) — under settlements, above tiles */}
      {overlays.map((o) => {
        const p = positions.get(o.vertex);
        if (!p) return null;
        const color = OVERLAY_COLORS[o.tone];
        return (
          <g key={`ov-${o.vertex}`} pointerEvents="none">
            <circle cx={p.x} cy={p.y} r={13} fill="none" stroke={color} strokeWidth={3.5} />
            <text x={p.x} y={p.y - 17} textAnchor="middle" fontSize={11} fontWeight={800} fill={color} stroke="#ffffff" strokeWidth={3} paintOrder="stroke">
              {o.label}
            </text>
          </g>
        );
      })}

      {/* Legal placement targets */}
      {[...legal].map((k) => {
        const p = positions.get(k)!;
        return (
          <g
            key={`legal-${k}`}
            className="legal-spot"
            role="button"
            tabIndex={0}
            aria-label={`Place settlement at ${describeVertex(board, k)}`}
            onClick={() => onVertexClick(k)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onVertexClick(k);
            }}
          >
            <circle cx={p.x} cy={p.y} r={11} fill="#ffffff00" />
            <circle className="legal-ring" cx={p.x} cy={p.y} r={7.5} fill="#ffffffd8" stroke="#2563eb" strokeWidth={2.5} />
          </g>
        );
      })}

      {/* Settlements */}
      {placements.map((pl) => {
        const p = positions.get(pl.vertex)!;
        const color = seatColors[pl.player];
        const isLast = pl.vertex === lastPlaced;
        return (
          <g key={`s-${pl.vertex}`} transform={`translate(${p.x}, ${p.y})`}>
            {isLast && <circle r={13.5} fill="none" stroke="#111827" strokeWidth={1.5} strokeDasharray="3 2" />}
            <path
              d="M -7.5 7 L -7.5 -1.5 L 0 -8.5 L 7.5 -1.5 L 7.5 7 Z"
              fill={color}
              stroke="#1f2937"
              strokeWidth={1.6}
            />
          </g>
        );
      })}
    </svg>
  );
}
