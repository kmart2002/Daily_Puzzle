import { EdgeKey, edgeEndpoints, hexCorners, parseVertexKey, vertexPos } from '../engine/catan/board';
import { describeVertex } from '../engine/catan/evaluate';
import { Board, PIPS, Placement, Road, TileType, VertexKey } from '../engine/catan/types';

const SIZE = 46;
const PAD = 82;

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

const TILE_TYPES: TileType[] = ['brick', 'lumber', 'ore', 'grain', 'wool', 'desert'];

/** Lighten (pct > 0) or darken (pct < 0) a hex color for gradient stops. */
function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct);
  r = Math.round((t - r) * p) + r;
  g = Math.round((t - g) * p) + g;
  b = Math.round((t - b) * p) + b;
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

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
  /** Highlighted road directions (e.g. the best road for a graded step). */
  edgeOverlays?: { edge: EdgeKey; tone: Overlay['tone'] }[];
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

/** A small pitched-roof house, centered on the origin. */
function Settlement({ color }: { color: string }) {
  return (
    <g filter="url(#pieceShadow)">
      <path
        d="M -8 8 L -8 -2 L 0 -9.5 L 8 -2 L 8 8 Z"
        fill={color}
        stroke={shade(color, -0.45)}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      {/* roof highlight */}
      <path d="M -8 -2 L 0 -9.5 L 8 -2 Z" fill={shade(color, 0.28)} opacity={0.85} />
      {/* wall shading */}
      <path d="M 8 -2 L 8 8 L 2 8 L 2 -2 Z" fill={shade(color, -0.22)} opacity={0.55} />
    </g>
  );
}

export function BoardView({
  board, placements, roads, legal, onVertexClick, legalEdges, onEdgeClick,
  seatColors, overlays = [], edgeOverlays = [], lastPlaced,
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
      <defs>
        {/* Per-tile vertical gradient: lit from top, shaded at the bottom edge. */}
        {TILE_TYPES.map((t) => (
          <linearGradient key={t} id={`tile-${t}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={shade(TILE_COLORS[t], 0.16)} />
            <stop offset="55%" stopColor={TILE_COLORS[t]} />
            <stop offset="100%" stopColor={shade(TILE_COLORS[t], -0.14)} />
          </linearGradient>
        ))}
        <radialGradient id="token-face" cx="42%" cy="38%" r="72%">
          <stop offset="0%" stopColor="#fffdf6" />
          <stop offset="100%" stopColor="#ecd9a8" />
        </radialGradient>
        <radialGradient id="water" cx="50%" cy="42%" r="75%">
          <stop offset="0%" stopColor="#2f86ba" />
          <stop offset="60%" stopColor="#1f6394" />
          <stop offset="100%" stopColor="#164a70" />
        </radialGradient>
        <filter id="tileShadow" x="-20%" y="-20%" width="140%" height="145%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2.4" floodColor="#06253a" floodOpacity="0.45" />
        </filter>
        <filter id="pieceShadow" x="-40%" y="-40%" width="180%" height="185%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.4" floodColor="#0b1220" floodOpacity="0.55" />
        </filter>
        <filter id="tokenShadow" x="-40%" y="-40%" width="180%" height="185%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.3" floodColor="#3a2c10" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Water backdrop */}
      <rect x={minX} y={minY} width={width} height={height} fill="url(#water)" />

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
            <polygon
              points={points}
              fill={`url(#tile-${hex.tile})`}
              stroke={shade(TILE_COLORS[hex.tile], -0.3)}
              strokeWidth={1.5}
              strokeLinejoin="round"
              filter="url(#tileShadow)"
            />
            {/* inner rim for a subtle bevel */}
            <polygon
              points={points}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={0.22}
              strokeWidth={1.2}
              transform={`translate(${cx} ${cy}) scale(0.9) translate(${-cx} ${-cy})`}
            />
            <text
              x={cx}
              y={cy - 21}
              textAnchor="middle"
              fontSize={15}
              style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.35))' }}
            >
              {TILE_LABELS[hex.tile]}
            </text>
            {token !== null && (
              <g filter="url(#tokenShadow)">
                <circle cx={cx} cy={cy + 5} r={16} fill="url(#token-face)" stroke="#b79a5c" strokeWidth={0.8} />
                <circle cx={cx} cy={cy + 5} r={16} fill="none" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={0.8} transform={`translate(0 -0.6)`} />
                <text
                  x={cx}
                  y={cy + 8}
                  textAnchor="middle"
                  fontSize={red ? 17 : 15}
                  fontWeight={800}
                  fill={red ? '#c0392b' : '#33302a'}
                  fontFamily="'Georgia', serif"
                >
                  {token}
                </text>
                <g fill={red ? '#c0392b' : '#4a4535'}>
                  {Array.from({ length: PIPS[token] }, (_, i) => (
                    <circle
                      key={i}
                      cx={cx + (i - (PIPS[token] - 1) / 2) * 4}
                      cy={cy + 15.5}
                      r={1.4}
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
        const ox = mx + (mx / len) * 36;
        const oy = my + (my / len) * 36;
        const label = port.kind === 'any' ? '3:1' : `2:1${TILE_LABELS[port.kind]}`;
        return (
          <g key={i} className="port">
            <line x1={a.x} y1={a.y} x2={ox} y2={oy} stroke="#8a6a42" strokeWidth={2.4} strokeLinecap="round" />
            <line x1={b.x} y1={b.y} x2={ox} y2={oy} stroke="#8a6a42" strokeWidth={2.4} strokeLinecap="round" />
            <circle cx={ox} cy={oy} r={14.5} fill="#f4ead0" stroke="#8a6a42" strokeWidth={1.6} filter="url(#tokenShadow)" />
            <text x={ox} y={oy + 4} textAnchor="middle" fontSize={port.kind === 'any' ? 11 : 9} fontWeight={800} fill="#5b4426">
              {label}
            </text>
          </g>
        );
      })}

      {/* Roads */}
      {roads.map((road) => {
        const [ka, kb] = edgeEndpoints(road.edge);
        const seg = trimmed(positions.get(ka)!, positions.get(kb)!);
        const color = seatColors[road.player];
        return (
          <g key={`r-${road.edge}`} filter="url(#pieceShadow)">
            <line {...seg} stroke={shade(color, -0.5)} strokeWidth={9.5} strokeLinecap="round" />
            <line {...seg} stroke={color} strokeWidth={6} strokeLinecap="round" />
            <line {...seg} stroke={shade(color, 0.4)} strokeWidth={1.8} strokeLinecap="round" opacity={0.7} />
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

      {/* Edge overlays (recommended road directions) */}
      {edgeOverlays.map((o) => {
        const [ka, kb] = edgeEndpoints(o.edge);
        const seg = trimmed(positions.get(ka)!, positions.get(kb)!, 0.12);
        return (
          <line
            key={`eo-${o.edge}`}
            {...seg}
            stroke={OVERLAY_COLORS[o.tone]}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray="8 5"
            pointerEvents="none"
          />
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
            {isLast && (
              <circle r={14.5} fill="none" stroke="#fef3c7" strokeWidth={2} strokeDasharray="3 2.5" className="last-placed-ring" />
            )}
            <Settlement color={color} />
          </g>
        );
      })}
    </svg>
  );
}
