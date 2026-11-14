// Malé sdílené prvky rozhraní.

import type { ReactNode } from 'react';
import { STATUS_LABEL, pp, type StatusKind } from '../../adapters/cs';

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

export function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

export function download(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
