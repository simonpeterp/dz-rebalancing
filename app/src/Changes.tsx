// Viditelnost změn: lišta, která říká, co se proti výchozímu stavu posunulo,
// a srovnání původního a nového plánu vedle sebe.

import { STATUS_LABEL, czk, day, pct, label, signed, statusKind, variantTitle } from '../../adapters/cs';
import type { Plan, PlanDiff, TradeDiff } from '../../engine';
import type { Row } from './App';
import { ChangeTag, StatusChip } from './ui';

interface BarProps {
  changes: string[];
  rows: Row[];
  compare: boolean;
  onCompare: () => void;
  onRevert: () => void;
  onConfirm: () => void;
}

export function ChangeBar({ changes, rows, compare, onCompare, onRevert, onConfirm }: BarProps) {
  const hit = rows.filter((r) => r.diff.changed);
  const sum = (f: (d: PlanDiff) => number) => rows.reduce((a, r) => a + f(r.diff), 0);
  return (
    <section className="changebar" aria-label="Změny proti výchozímu stavu">
      <div className="changebar-main">
        <div className="changebar-title">Změny proti výchozímu stavu</div>
        <div className="changebar-list">
          {changes.map((c) => (
            <span key={c} className="changebar-chip">
              {c}
            </span>
          ))}
        </div>
        <div className="changebar-impact">
          {hit.length === 0 ? (
            'Na navržených obchodech ani nákladech se nic nezměnilo.'
          ) : (
            <>
              Plán se změnil u {hit.length} z {rows.length} klientů ({hit.map((r) => r.plan.clientName.replace(/^Klient /, '')).join(', ')}) · obrat {signed(sum((d) => d.delta.turnoverCzk))} ·
              poplatky {signed(sum((d) => d.delta.feesCzk))} · daň {signed(sum((d) => d.delta.taxCzk))}
            </>
          )}
        </div>
      </div>
      <div className="changebar-actions">
        <button className="btn btn-accent" onClick={onCompare} aria-pressed={compare}>
          {compare ? 'Skrýt srovnání' : 'Porovnat před a po'}
        </button>
        <button className="btn btn-dark" onClick={onRevert}>
          Vrátit zpět
        </button>
        <button className="btn btn-dark" onClick={onConfirm} title="Současný stav se stane výchozím pro další porovnávání. Nic se neukládá ani neodesílá.">
          Vzít jako výchozí stav
        </button>
      </div>
    </section>
  );
}

const tradeChanges = (d: PlanDiff) => {
  const parts = [d.added ? `${d.added} nových` : '', d.removed ? `${d.removed} zrušených` : '', d.modified ? `${d.modified} změněných` : ''].filter(Boolean);
  return parts.length ? parts.join(', ') : 'beze změny';
};

/** Přehled: všichni klienti, původní a nový plán v jedné tabulce. */
export function CompareAll({ rows }: { rows: Row[] }) {
  const tot = (f: (r: Row) => number) => rows.reduce((a, r) => a + f(r), 0);
  return (
    <section className="card compare">
      <h2>Srovnání před a po</h2>
      <p className="muted">Výchozí stav proti současnému nastavení. Změněné řádky jsou zvýrazněné.</p>
      <div className="scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>Klient</th>
              <th>Před</th>
              <th>Po</th>
              <th>Pokyny</th>
              <th className="num">Obrat před</th>
              <th className="num">Obrat po</th>
              <th className="num">Náklady před</th>
              <th className="num">Náklady po</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.plan.clientName} className={r.diff.changed ? 'row-changed' : ''}>
                <td>
                  <a className="client-name" href={`#/klient/${encodeURIComponent(r.plan.clientName)}`}>
                    {r.plan.clientName}
                  </a>
                </td>
                <td>
                  {STATUS_LABEL[statusKind(r.base)]}
                  <div className="sub">{r.base.status === 'none' ? '' : variantTitle(r.base)}</div>
                </td>
                <td>
                  {STATUS_LABEL[statusKind(r.plan)]}
                  <div className="sub">{r.plan.status === 'none' ? '' : variantTitle(r.plan)}</div>
                </td>
                <td>{tradeChanges(r.diff)}</td>
                <td className="num">{czk(r.base.turnoverCzk)}</td>
                <td className="num">{czk(r.plan.turnoverCzk)}</td>
                <td className="num">{czk(r.base.costCzk)}</td>
                <td className="num">{czk(r.plan.costCzk)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Celkem</td>
              <td className="num">{czk(tot((r) => r.base.turnoverCzk))}</td>
              <td className="num">{czk(tot((r) => r.plan.turnoverCzk))}</td>
              <td className="num">{czk(tot((r) => r.base.costCzk))}</td>
              <td className="num">{czk(tot((r) => r.plan.costCzk))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function PlanColumn({ title, plan, other, trades, side }: { title: string; plan: Plan; other: Plan; trades: TradeDiff[]; side: 'before' | 'after' }) {
  const mine = trades.filter((t) => (side === 'before' ? t.before : t.after));
  const cell = (now: number, was: number, f: (x: number) => string) => <span className={Math.abs(now - was) >= 1 ? 'hl' : ''}>{f(now)}</span>;
  return (
    <div className="compare-col">
      <div className="compare-head">
        <span className="compare-title">{title}</span>
        <StatusChip kind={statusKind(plan)} />
        {plan.status !== 'none' && <span className="sub-inline">{variantTitle(plan)}</span>}
      </div>
      {mine.length === 0 ? (
        <p className="muted">Žádný obchod.</p>
      ) : (
        <table className="tbl tbl-compact">
          <tbody>
            {mine.map((t) => {
              const tr = (side === 'before' ? t.before : t.after)!;
              const kind = t.kind === 'same' ? 'same' : side === 'before' ? (t.kind === 'removed' ? 'removed' : t.kind === 'changed' ? 'changed' : 'same') : t.kind;
              return (
                <tr key={t.key} className={kind === 'same' ? '' : 'row-changed'}>
                  <td>{t.date === plan.stages[0]?.date && plan.stages[0].isNow ? 'hned' : day(t.date)}</td>
                  <td>
                    <span className={`side side-${t.side}`}>{t.side === 'buy' ? 'Nákup' : 'Prodej'}</span>
                  </td>
                  <td>
                    <strong>{t.ticker}</strong> <ChangeTag kind={kind} />
                  </td>
                  <td className="num">{czk(tr.czk)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <dl className="compare-nums">
        <dt>Obrat</dt>
        <dd>{cell(plan.turnoverCzk, other.turnoverCzk, czk)}</dd>
        <dt>Poplatky</dt>
        <dd>{cell(plan.feesCzk, other.feesCzk, czk)}</dd>
        <dt>Daň</dt>
        <dd>{cell(plan.taxCzk, other.taxCzk, czk)}</dd>
        <dt>Váhy po zásahu</dt>
        <dd>
          {plan.after.map((a, i) => (
            <span key={a.key} className={`w ${Math.abs(a.weight - (other.after[i]?.weight ?? a.weight)) >= 0.0005 ? 'hl' : ''}`}>
              {label(a.key)} {pct(a.weight)}
            </span>
          ))}
        </dd>
      </dl>
    </div>
  );
}

/** Detail klienta: původní a nový plán vedle sebe. */
export function CompareClient({ row }: { row: Row }) {
  return (
    <section className="card compare">
      <h2>Srovnání před a po</h2>
      <p className="muted">Vlevo výchozí stav, vpravo plán po změnách. Rozdíly jsou zvýrazněné.</p>
      <div className="compare-grid">
        <PlanColumn title="Před" plan={row.base} other={row.plan} trades={row.diff.trades} side="before" />
        <PlanColumn title="Po" plan={row.plan} other={row.base} trades={row.diff.trades} side="after" />
      </div>
    </section>
  );
}
