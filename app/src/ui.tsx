// Malé sdílené prvky rozhraní.

import { isValidElement, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { STATUS_LABEL, pp, signed, type StatusKind } from '../../adapters/cs';
import { CASH, type ChangeKind, type Dataset } from '../../engine';

export function StatusChip({ kind }: { kind: StatusKind }) {
  return <span className={`chip chip-${kind}`}>{STATUS_LABEL[kind]}</span>;
}

/**
 * Odchylka od cíle vůči tolerančnímu pásmu. Střed = cíl, šedá zóna = pásmo,
 * plný bod = teď, prázdný bod = po zásahu.
 */
export function DriftBar({ drift, tolerance, after }: { drift: number; tolerance: number; after?: number }) {
  const span = 2.5; // osa sahá do ±2,5násobku pásma
  const pos = (d: number) => 50 + (Math.max(-span, Math.min(span, d / tolerance)) / span) * 50;
  const out = Math.abs(drift) > tolerance;
  return (
    <div className="drift" role="img" aria-label={`Odchylka ${pp(drift)}, pásmo ±${pp(tolerance).replace('+', '')}`}>
      <div className="drift-zone" style={{ left: `${pos(-tolerance)}%`, width: `${pos(tolerance) - pos(-tolerance)}%` }} />
      <div className="drift-mid" />
      {after !== undefined && Math.abs(after - drift) > 1e-4 && <div className="drift-dot drift-after" style={{ left: `${pos(after)}%` }} />}
      <div className={`drift-dot ${out ? 'drift-out' : ''}`} style={{ left: `${pos(drift)}%` }} />
    </div>
  );
}

export function Kpi({ label, value, hint, delta: d }: { label: string; value: ReactNode; hint?: ReactNode; delta?: ReactNode }) {
  // <Delta value={0} /> nic nevykreslí, ale jako prvek je „pravdivý“: nulový rozdíl proto dlaždici nezvýrazní.
  const delta = isValidElement<{ value?: number }>(d) && typeof d.props.value === 'number' && Math.abs(d.props.value) < 0.5 ? null : d;
  return (
    <div className={`kpi ${delta ? 'kpi-changed' : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {delta && <div className="kpi-delta">{delta}</div>}
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

/**
 * Rozdíl proti výchozímu stavu. `tone="cost"`: růst je špatně (červeně), pokles dobře (zeleně).
 * Nulový rozdíl se nevykreslí.
 */
export function Delta({ value, tone = 'neutral', format = signed, suffix = 'proti výchozímu' }: { value: number; tone?: 'cost' | 'neutral'; format?: (x: number) => string; suffix?: string }) {
  if (Math.abs(value) < 0.5) return null;
  const cls = tone === 'cost' ? (value > 0 ? 'delta-bad' : 'delta-good') : 'delta-neutral';
  return (
    <span className={`delta ${cls}`}>
      <span aria-hidden="true">{value > 0 ? '▲' : '▼'}</span> {format(value)} <span className="delta-suffix">{suffix}</span>
    </span>
  );
}

const CHANGE_LABEL: Record<ChangeKind, string> = { same: '', added: 'nové', removed: 'zrušeno', changed: 'změněno' };
export function ChangeTag({ kind }: { kind: ChangeKind }) {
  return kind === 'same' ? null : <span className={`tag tag-${kind}`}>{CHANGE_LABEL[kind]}</span>;
}

export function download(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Barvy aktiv v grafech. Barva patří instrumentu (podle pořadí v listu Instrumenty),
 * ne jeho pořadí v grafu, takže VWCE má všude stejnou. Hotovost je neutrální šedá.
 */
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const CASH_COLOR = '#8a8580';
export function assetColor(data: Dataset, key: string): string {
  if (key === CASH) return CASH_COLOR;
  const i = data.instruments.findIndex((x) => x.ticker === key);
  return i >= 0 && i < SERIES.length ? SERIES[i] : '#b9b4ad';
}

/** Skutečná šířka prvku v pixelech, aby text v SVG grafech zůstal ve stejné velikosti. */
export function useWidth<T extends HTMLElement>(initial = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setWidth(Math.max(200, Math.floor(el.clientWidth)));
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Bublina s detailem pod kurzorem. */
export function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);
  const show = (e: MouseEvent, content: ReactNode) => setTip({ x: e.clientX, y: e.clientY, content });
  const hide = () => setTip(null);
  const node = tip && (
    <div className="tip" role="status" style={{ left: Math.max(8, Math.min(tip.x + 14, window.innerWidth - 300)), top: tip.y + 16 }}>
      {tip.content}
    </div>
  );
  return { show, hide, node };
}
