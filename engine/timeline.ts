// Pohled v čase: jak se budou vyvíjet váhy portfolia a co se kdy stane.
// Vše při dnešních cenách – nástroj nepředpovídá trh. Váhy se proto mění jen ve dnech,
// kdy proběhne vklad, výběr nebo obchod.

import { addDays } from './dates';
import type { Plan, Trade } from './plan';
import { CASH } from './types';

export interface PathPoint {
  date: string;
  totalCzk: number;
  weight: Record<string, number>; // klíč = ticker nebo CASH
  drift: Record<string, number>; // váha − cíl
}

/** Konec období, které má smysl kreslit: konec horizontu, nebo poslední etapa plánu. */
export const planEnd = (p: Plan) => p.stages.reduce((a, st) => (st.date > a ? st.date : a), p.horizonEnd);

/**
 * Vývoj vah od data ocenění do `until`. S `trades: false` vrací, co by se stalo bez zásahu
 * (proběhnou jen vklady a výběry). První bod je stav před dnešními obchody.
 * Poplatky a daň se z hotovosti neodečítají, stejně jako u vah „po zásahu“.
 */
export function driftPath(asOf: string, plan: Plan, opts: { trades: boolean; until: string }): PathPoint[] {
  const value: Record<string, number> = {};
  for (const a of plan.valuation.assets) value[a.key] = a.valueCzk;

  const deltas = new Map<string, Record<string, number>>();
  const bump = (date: string, key: string, x: number) => {
    const d = deltas.get(date) ?? {};
    d[key] = (d[key] ?? 0) + x;
    deltas.set(date, d);
  };
  for (const f of [...plan.flows, ...plan.flowsLater]) if (f.date <= opts.until) bump(f.date, CASH, f.amountCzk);
  if (opts.trades)
    for (const st of plan.stages)
      for (const t of st.trades) {
        const sign = t.side === 'buy' ? 1 : -1;
        bump(st.date, t.ticker, sign * t.czk);
        bump(st.date, CASH, -sign * t.czk);
      }

  const point = (date: string): PathPoint => {
    const totalCzk = Object.values(value).reduce((a, b) => a + b, 0);
    const weight: Record<string, number> = {};
    const drift: Record<string, number> = {};
    for (const a of plan.valuation.assets) {
      weight[a.key] = totalCzk > 0 ? value[a.key] / totalCzk : 0;
      drift[a.key] = weight[a.key] - a.target;
    }
    return { date, totalCzk, weight, drift };
  };

  const out = [point(asOf)];
  for (const date of [...deltas.keys()].sort()) {
    for (const [k, x] of Object.entries(deltas.get(date) as Record<string, number>)) value[k] = (value[k] ?? 0) + x;
    out.push(point(date));
  }
  const last = out[out.length - 1];
  if (last.date < opts.until) out.push({ ...last, date: opts.until });
  return out;
}

export type AgendaEvent =
  | {
      kind: 'trade';
      date: string;
      clientName: string;
      isNow: boolean;
      trades: Trade[];
      sellCzk: number;
      buyCzk: number;
      part: number | null; // kolikátá část rozloženého zásahu
      parts: number;
      afterTimeTest: boolean; // prodej odložený na splnění časového testu
    }
  | { kind: 'flow'; date: string; clientName: string; amountCzk: number; note: string; inHorizon: boolean }
  | { kind: 'exempt'; date: string; clientName: string; ticker: string; buyDate: string; valueCzk: number; taxSavedCzk: number };

const KIND_ORDER = { trade: 0, flow: 1, exempt: 2 } as const;

/**
 * Všechno, co se má stát, v jednom seznamu seřazeném podle data: navržené obchody,
 * plánované vklady a výběry a dny, kdy nákupy splní časový test.
 */
export function agenda(asOf: string, plans: Plan[], withinDays = 365): AgendaEvent[] {
  const end = addDays(asOf, withinDays);
  const out: AgendaEvent[] = [];
  for (const p of plans) {
    const clientName = p.clientName;
    for (const st of p.stages) {
      const by = (side: Trade['side']) => st.trades.filter((t) => t.side === side).reduce((a, t) => a + t.czk, 0);
      const part = p.partDates.indexOf(st.date);
      out.push({
        kind: 'trade',
        date: st.date,
        clientName,
        isNow: st.isNow,
        trades: st.trades,
        sellCzk: by('sell'),
        buyCzk: by('buy'),
        part: part >= 0 ? part + 1 : null,
        parts: p.parts,
        afterTimeTest: st.trades.some((t) => t.lots.some((l) => l.deferred)),
      });
    }
    for (const f of [...p.flows, ...p.flowsLater])
      if (f.date <= end) out.push({ kind: 'flow', date: f.date, clientName, amountCzk: f.amountCzk, note: f.note, inHorizon: f.date <= p.horizonEnd });
    for (const l of p.valuation.lots)
      if (!l.exemptNow && l.exemptFrom !== null && l.gainCzk > 0 && l.exemptFrom <= end)
        out.push({ kind: 'exempt', date: l.exemptFrom, clientName, ticker: l.ticker, buyDate: l.buyDate, valueCzk: l.valueCzk, taxSavedCzk: l.taxIfSoldNowCzk });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.clientName.localeCompare(b.clientName, 'cs'));
}
