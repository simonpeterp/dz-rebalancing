// Porovnání dvou plánů téhož klienta: co přibylo, zmizelo a změnilo se.
// Slouží k zobrazení „před a po“, když uživatel změní pravidlo, přidá vklad nebo přepne variantu.

import type { Plan, Trade } from './plan';

export type ChangeKind = 'same' | 'added' | 'removed' | 'changed';

export interface TradeDiff {
  key: string; // datum|strana|ticker
  date: string;
  side: Trade['side'];
  ticker: string;
  kind: ChangeKind;
  before: Trade | null;
  after: Trade | null;
}

export interface PlanDiff {
  clientName: string;
  changed: boolean; // liší se cokoli podstatného: obchody, stav, náklady
  statusChanged: boolean;
  trades: TradeDiff[]; // sjednocení obchodů obou plánů, podle data
  added: number;
  removed: number;
  modified: number;
  delta: { turnoverCzk: number; sellCzk: number; buyCzk: number; feesCzk: number; taxCzk: number; costCzk: number };
}

const flat = (p: Plan) => p.stages.flatMap((st) => st.trades.map((t) => ({ key: `${st.date}|${t.side}|${t.ticker}`, date: st.date, trade: t })));
const lotsKey = (t: Trade) => t.lots.map((l) => `${l.buyDate}:${l.qty.toFixed(4)}:${l.exempt ? 'e' : 't'}`).join(',');
const sameTrade = (a: Trade, b: Trade) => Math.abs(a.czk - b.czk) < 1 && Math.abs(a.qty - b.qty) < 1e-4 && lotsKey(a) === lotsKey(b);

export function diffPlans(before: Plan, after: Plan): PlanDiff {
  const b = new Map(flat(before).map((x) => [x.key, x]));
  const a = new Map(flat(after).map((x) => [x.key, x]));
  const trades: TradeDiff[] = [];
  for (const key of new Set([...b.keys(), ...a.keys()])) {
    const x = b.get(key);
    const y = a.get(key);
    const ref = (y ?? x)!;
    const kind: ChangeKind = !x ? 'added' : !y ? 'removed' : sameTrade(x.trade, y.trade) ? 'same' : 'changed';
    trades.push({ key, date: ref.date, side: ref.trade.side, ticker: ref.trade.ticker, kind, before: x?.trade ?? null, after: y?.trade ?? null });
  }
  trades.sort((p, q) => p.date.localeCompare(q.date) || (p.side === q.side ? 0 : p.side === 'sell' ? -1 : 1));

  const d = (k: 'turnoverCzk' | 'sellCzk' | 'buyCzk' | 'feesCzk' | 'taxCzk' | 'costCzk') => after[k] - before[k];
  const delta = { turnoverCzk: d('turnoverCzk'), sellCzk: d('sellCzk'), buyCzk: d('buyCzk'), feesCzk: d('feesCzk'), taxCzk: d('taxCzk'), costCzk: d('costCzk') };
  const count = (k: ChangeKind) => trades.filter((t) => t.kind === k).length;
  const statusChanged = before.status !== after.status || before.variant !== after.variant;
  return {
    clientName: after.clientName,
    changed: statusChanged || trades.some((t) => t.kind !== 'same') || Math.abs(delta.costCzk) >= 1,
    statusChanged,
    trades,
    added: count('added'),
    removed: count('removed'),
    modified: count('changed'),
    delta,
  };
}
