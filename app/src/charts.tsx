// Grafy. Čisté SVG bez knihovny: koláč složení, odchylka v čase a časová osa událostí.
// Všechny kreslí stav při dnešních cenách – nic nepředpovídají.

import { useState, type MouseEvent } from 'react';
import { czk, day, dayShort, pct, pp } from '../../adapters/cs';
import { addDays, diffDays, type AssetRow, type PathPoint } from '../../engine';
import { useTip, useWidth } from './ui';

const INK = '#0d0708';
const MUTED = '#8a8580';
const IDLE = '#b3ada6';
const GRID = '#e8e5e0';
const AXIS = '#c9c4bd';

/* ───────────── Složení portfolia ───────────── */

export interface Series {
  key: string;
  name: string;
  sub?: string;
  color: string;
}

function Donut({ series, values, title, sub, size = 150 }: { series: Series[]; values: Record<string, number>; title: string; sub: string; size?: number }) {
  const tip = useTip();
  const v = (k: string) => Math.max(0, values[k] ?? 0);
  const total = series.reduce((a, s) => a + v(s.key), 0);
  const th = 24;
  const r = (size - th) / 2;
  const C = 2 * Math.PI * r;
  const c = size / 2;
  let start = 0;
  return (
    <figure className="donut">
      <svg width={size} height={size} role="img" aria-label={`${title}: ${series.map((s) => `${s.name} ${pct(total > 0 ? v(s.key) / total : 0)}`).join(', ')}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke={GRID} strokeWidth={th} />
        {series.map((s) => {
          const len = total > 0 ? (v(s.key) / total) * C : 0;
          const from = start;
          start += len;
          if (len < 0.5) return null;
          const seg = Math.max(1, len - 2); // 2px mezera v barvě plochy odděluje sousední výseče
          return (
            <circle
              key={s.key}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={th}
              strokeDasharray={`${seg} ${C - seg}`}
              strokeDashoffset={-(from + 1)}
              transform={`rotate(-90 ${c} ${c})`}
              onMouseMove={(e) =>
                tip.show(
                  e,
                  <>
                    <strong>{s.name}</strong>
                    <div>
                      {title}: {pct(v(s.key) / total)} · {czk(v(s.key))}
                    </div>
                  </>,
                )
              }
              onMouseLeave={tip.hide}
            />
          );
        })}
        <text x={c} y={c - 3} textAnchor="middle" className="donut-title">
          {title}
        </text>
        <text x={c} y={c + 14} textAnchor="middle" className="donut-sub">
          {sub}
        </text>
      </svg>
      {tip.node}
    </figure>
  );
}

/**
 * Složení jako koláče vedle sebe (např. teď a po zásahu) a pod nimi legenda,
 * která je zároveň tabulkou hodnot včetně cíle.
 */
export function Allocation({ series, states, target }: { series: Series[]; states: { title: string; sub: string; values: Record<string, number> }[]; target: Record<string, number> }) {
  const share = (values: Record<string, number>, k: string) => {
    const total = series.reduce((a, s) => a + Math.max(0, values[s.key] ?? 0), 0);
    return total > 0 ? Math.max(0, values[k] ?? 0) / total : 0;
  };
  return (
    <div className="alloc">
      <div className="alloc-donuts">
        {states.map((st) => (
          <Donut key={st.title} series={series} values={st.values} title={st.title} sub={st.sub} />
        ))}
      </div>
      <table className="tbl tbl-legend">
        <thead>
          <tr>
            <th>Aktivum</th>
            {states.map((st) => (
              <th key={st.title} className="num">
                {st.title}
              </th>
            ))}
            <th className="num">Cíl</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.key}>
              <td>
                <span className="swatch" style={{ background: s.color }} />
                <strong>{s.name}</strong>
                {s.sub && <span className="sub-inline">{s.sub}</span>}
              </td>
              {states.map((st) => (
                <td key={st.title} className="num">
                  {pct(share(st.values, s.key))}
                </td>
              ))}
              <td className="num">{pct(target[s.key] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────── Odchylka od cíle v čase ───────────── */

const ppShort = (x: number) => pp(x).replace(' p. b.', '');
const at = (pts: PathPoint[], date: string) => pts.reduce((a, p) => (p.date <= date ? p : a), pts[0]);

function DriftPanel({ asset, name, color, plan, idle, showIdle }: { asset: AssetRow; name: string; color: string; plan: PathPoint[]; idle: PathPoint[]; showIdle: boolean }) {
  const [ref, w] = useWidth<HTMLDivElement>(260);
  const tip = useTip();
  const [hover, setHover] = useState<string | null>(null);
  const k = asset.key;
  const from = plan[0].date;
  const to = plan[plan.length - 1].date;
  const H = 138;
  const L = 40;
  const R = 46;
  const T = 10;
  const B = 22;
  const span = Math.max(1, diffDays(from, to));
  const x = (d: string) => L + (diffDays(from, d) / span) * (w - L - R);
  const all = [...plan, ...(showIdle ? idle : [])].map((p) => Math.abs(p.drift[k]));
  const m = Math.max(asset.tolerance * 1.6, ...all) * 1.15;
  const y = (v: number) => T + (1 - (v + m) / (2 * m)) * (H - T - B);
  const step = (pts: PathPoint[]) => pts.map((p, i) => (i === 0 ? `M${x(p.date)},${y(p.drift[k])}` : `H${x(p.date)}V${y(p.drift[k])}`)).join('');

  const tol = asset.tolerance;
  const bandLabels = y(0) - y(tol) >= 12;
  const start = plan[0].drift[k];
  const end = plan[plan.length - 1].drift[k];
  const idleEnd = idle[idle.length - 1].drift[k];
  const startLabel = !bandLabels && Math.abs(y(start) - y(0)) >= 12;

  const move = (e: MouseEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
    const d = addDays(from, Math.round(frac * span));
    setHover(d);
    const a = at(plan, d).drift[k];
    const b = at(idle, d).drift[k];
    tip.show(
      e,
      <>
        <strong>
          {name} · {day(d)}
        </strong>
        <div>
          {showIdle ? 'S plánem' : 'Odchylka'}: {pp(a)}
          {Math.abs(a) > tol + 1e-9 ? ' (mimo pásmo)' : ''}
        </div>
        {showIdle && <div>Bez zásahu: {pp(b)}</div>}
        <div className="tip-muted">Pásmo ±{ppShort(tol).replace('+', '')} p. b.</div>
      </>,
    );
  };

  return (
    <div className="drift-panel" ref={ref}>
      <div className="drift-panel-head">
        <span className="swatch" style={{ background: color }} />
        <strong>{name}</strong>
        <span className="sub-inline">cíl {pct(asset.target)}</span>
      </div>
      <svg width={w} height={H} role="img" aria-label={`${name}: odchylka od cíle ${pp(start)} na začátku, ${pp(end)} na konci období, pásmo ±${ppShort(tol).replace('+', '')} p. b.`}>
        <rect x={L} y={y(tol)} width={w - L - R} height={y(-tol) - y(tol)} fill="#e2f1e8" />
        <line x1={L} x2={w - R} y1={y(0)} y2={y(0)} stroke={AXIS} />
        <text x={L - 6} y={y(0) + 4} textAnchor="end" className="ax">
          cíl
        </text>
        {bandLabels && (
          <>
            <text x={L - 6} y={y(tol) + 4} textAnchor="end" className="ax">
              {ppShort(tol)}
            </text>
            <text x={L - 6} y={y(-tol) + 4} textAnchor="end" className="ax">
              {ppShort(-tol)}
            </text>
          </>
        )}
        {startLabel && (
          <text x={L - 6} y={y(start) + 4} textAnchor="end" className="ax">
            {ppShort(start)}
          </text>
        )}
        {showIdle && <path d={step(idle)} fill="none" stroke={IDLE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        <path d={step(plan)} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(to)} cy={y(end)} r={4} fill={INK} stroke="#fff" strokeWidth={2} />
        <text x={w - R + 8} y={y(end) + 4} className="ax ax-strong">
          {ppShort(end)}
        </text>
        {showIdle && Math.abs(y(idleEnd) - y(end)) >= 13 && (
          <text x={w - R + 8} y={y(idleEnd) + 4} className="ax">
            {ppShort(idleEnd)}
          </text>
        )}
        <text x={L} y={H - 6} className="ax">
          {dayShort(from)}
        </text>
        <text x={w - R} y={H - 6} textAnchor="end" className="ax">
          {dayShort(to)}
        </text>
        {hover && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke={INK} strokeOpacity={0.35} />}
        <rect
          x={L}
          y={T}
          width={w - L - R}
          height={H - T - B}
          fill="transparent"
          onMouseMove={move}
          onMouseLeave={() => {
            setHover(null);
            tip.hide();
          }}
        />
      </svg>
      {tip.node}
    </div>
  );
}

/**
 * Malé grafy vedle sebe, jeden na aktivum: jak daleko je váha od cíle (v p. b.) od dneška
 * do konce plánu. Zelený pruh je toleranční pásmo. Čáry se lámou jen ve dnech vkladu,
 * výběru nebo obchodu, protože ceny se berou dnešní.
 */
export function DriftOverTime({ assets, names, colorOf, plan, idle, showIdle }: { assets: AssetRow[]; names: (key: string) => string; colorOf: (key: string) => string; plan: PathPoint[]; idle: PathPoint[]; showIdle: boolean }) {
  return (
    <>
      <div className="chart-legend">
        <span>
          <i className="key-line" style={{ background: INK }} />
          {showIdle ? 's navrženým plánem' : 'odchylka od cíle'}
        </span>
        {showIdle && (
          <span>
            <i className="key-line" style={{ background: IDLE }} />
            bez zásahu
          </span>
        )}
        <span>
          <i className="key-box" style={{ background: '#e2f1e8' }} />
          toleranční pásmo
        </span>
      </div>
      <div className="drift-panels">
        {assets.map((a) => (
          <DriftPanel key={a.key} asset={a} name={names(a.key)} color={colorOf(a.key)} plan={plan} idle={idle} showIdle={showIdle} />
        ))}
      </div>
    </>
  );
}

/* ───────────── Časová osa událostí ───────────── */

export type TLKind = 'trade' | 'in' | 'out' | 'exempt';
export interface TLItem {
  date: string;
  kind: TLKind;
  title: string;
  detail?: string;
}
export interface TLLane {
  label: string;
  href?: string;
  items: TLItem[];
}

const MONTHS = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];

function Glyph({ kind, cx, cy }: { kind: TLKind; cx: number; cy: number }) {
  if (kind === 'trade') return <circle cx={cx} cy={cy} r={6} fill={INK} stroke="#fff" strokeWidth={2} />;
  if (kind === 'exempt') return <rect x={cx - 5} y={cy - 5} width={10} height={10} fill="#ffd900" stroke={INK} strokeWidth={1.5} transform={`rotate(45 ${cx} ${cy})`} />;
  const s = kind === 'in' ? -1 : 1; // vklad míří nahoru, výběr dolů
  return <path d={`M${cx - 7},${cy - 5 * s} L${cx + 7},${cy - 5 * s} L${cx},${cy + 7 * s} Z`} fill={kind === 'in' ? '#17693f' : '#b3261e'} stroke="#fff" strokeWidth={2} strokeLinejoin="round" />;
}

export const TL_LEGEND: [TLKind, string][] = [
  ['trade', 'obchod'],
  ['in', 'vklad'],
  ['out', 'výběr'],
  ['exempt', 'osvobození od daně'],
];

export function TimelineLegend({ kinds }: { kinds: TLKind[] }) {
  return (
    <div className="chart-legend">
      {TL_LEGEND.filter(([k]) => kinds.includes(k)).map(([k, name]) => (
        <span key={k}>
          <svg width={18} height={18} aria-hidden="true">
            <Glyph kind={k} cx={9} cy={9} />
          </svg>
          {name}
        </span>
      ))}
    </div>
  );
}

/**
 * Události na společné časové ose. Jeden řádek na klienta (přehled) nebo na druh události (detail).
 * `spread` rozestoupí různé druhy ve stejném řádku, aby se nepřekrývaly.
 * `labels` připíše pod značky datum (kde je na něj místo), aby osa šla číst i bez najetí myší.
 */
export function Timeline({ lanes, from, to, horizonEnd, spread = false, labels = false }: { lanes: TLLane[]; from: string; to: string; horizonEnd?: string; spread?: boolean; labels?: boolean }) {
  const [ref, w] = useWidth<HTMLDivElement>(800);
  const tip = useTip();
  const labelW = Math.min(150, Math.max(...lanes.map((l) => l.label.length)) * 7.2 + 14);
  const L = labelW + 10;
  const R = 18;
  const T = 40;
  const laneH = labels ? 50 : spread ? 46 : 36;
  const H = T + lanes.length * laneH + 8;
  const span = Math.max(1, diffDays(from, to));
  const x = (d: string) => L + (Math.max(0, Math.min(span, diffDays(from, d))) / span) * (w - L - R);
  const offset: Record<TLKind, number> = spread ? { in: -11, out: -11, trade: 0, exempt: 11 } : { in: 0, out: 0, trade: 0, exempt: 0 };

  const months: { date: string; label: string }[] = [];
  for (let y = Number(from.slice(0, 4)), mo = Number(from.slice(5, 7)) + 1; ; mo++) {
    if (mo > 12) {
      mo = 1;
      y++;
    }
    const d = `${y}-${String(mo).padStart(2, '0')}-01`;
    if (d > to) break;
    months.push({ date: d, label: mo === 1 ? `${MONTHS[0]} ${y}` : MONTHS[mo - 1] });
  }
  const minGap = months.length > 1 ? x(months[1].date) - x(months[0].date) : 100;
  const every = Math.max(1, Math.ceil(34 / Math.max(1, minGap)));

  return (
    <div className="timeline" ref={ref}>
      <svg width={w} height={H} role="img" aria-label={`Časová osa od ${day(from)} do ${day(to)}. Stejné události jsou v seznamu pod grafem.`}>
        {months.map((m, i) => (
          <g key={m.date}>
            <line x1={x(m.date)} x2={x(m.date)} y1={T - 6} y2={H - 4} stroke={GRID} />
            {i % every === 0 && x(m.date) - L > 86 && (
              <text x={x(m.date) + 4} y={12} className="ax">
                {m.label}
              </text>
            )}
          </g>
        ))}
        <line x1={x(from)} x2={x(from)} y1={T - 6} y2={H - 4} stroke={INK} />
        <text x={x(from) + 4} y={12} className="ax ax-strong">
          ocenění {dayShort(from)}
        </text>
        {horizonEnd && horizonEnd < to && (
          <>
            <line x1={x(horizonEnd)} x2={x(horizonEnd)} y1={T - 6} y2={H - 4} stroke={MUTED} />
            <text x={x(horizonEnd) - 4} y={29} textAnchor="end" className="ax">
              konec horizontu
            </text>
          </>
        )}
        {lanes.map((lane, i) => {
          const cy = T + i * laneH + (labels ? 16 : laneH / 2);
          let lastLabelX = -100;
          return (
            <g key={lane.label}>
              <line x1={L} x2={w - R} y1={cy} y2={cy} stroke={GRID} />
              {lane.href ? (
                <a href={lane.href}>
                  <text x={0} y={cy + 4} className="ax ax-lane ax-link">
                    {lane.label}
                  </text>
                </a>
              ) : (
                <text x={0} y={cy + 4} className="ax ax-lane">
                  {lane.label}
                </text>
              )}
              {lane.items.map((it, j) => {
                const cx = x(it.date);
                const yy = cy + offset[it.kind];
                return (
                  <g
                    key={j}
                    className={lane.href ? 'tl-hit tl-link' : 'tl-hit'}
                    onMouseMove={(e) =>
                      tip.show(
                        e,
                        <>
                          <strong>
                            {day(it.date)} · {it.title}
                          </strong>
                          {it.detail && <div>{it.detail}</div>}
                        </>,
                      )
                    }
                    onMouseLeave={tip.hide}
                    onClick={() => lane.href && (window.location.hash = lane.href)}
                  >
                    <Glyph kind={it.kind} cx={cx} cy={yy} />
                    {labels &&
                      cx - lastLabelX >= 40 &&
                      ((lastLabelX = cx),
                      (
                        <text x={cx} y={yy + 23} textAnchor="middle" className="ax">
                          {dayShort(it.date)}
                        </text>
                      ))}
                    <circle cx={cx} cy={yy} r={12} fill="transparent" />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {tip.node}
    </div>
  );
}
