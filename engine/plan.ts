// Návrh zásahu pro jednoho klienta.
//
// Postup (podrobně v docs/POPIS.md):
//   1. Započti vklady a výběry v horizontu → „projektované“ portfolio.
//   2. Cash flow nejdřív: přebytek hotovosti nakup do podvážených aktiv,
//      chybějící hotovost získej prodejem nadvážených aktiv.
//   3. Je i potom něco mimo toleranční pásmo? → dorovnej vše na cíl.
//   4. Co prodat: po jednotlivých nákupech, daňově nejlevnější napřed.
//   5. Kdy: prodej nákupu, který bude brzy osvobozen, lze odložit (varianta „počkat“).

import { addDays, diffDays } from './dates';
import { isExemptOn, taxOnSales, taxRate } from './tax';
import { CASH, type CashFlow, type Dataset, type Settings } from './types';
import { tolerance, valuate, type AssetRow, type LotView, type Valuation } from './valuation';

export type PlanStatus = 'none' | 'cashflow' | 'rebalance' | 'wait';

export interface LotSale {
  ticker: string;
  buyDate: string;
  qty: number;
  czk: number;
  gainCzk: number;
  when: string; // datum prodeje
  exempt: boolean; // osvobozeno v den prodeje
  deferred: boolean; // prodej odložen kvůli časovému testu
}

export interface Trade {
  side: 'buy' | 'sell';
  ticker: string;
  qty: number;
  czk: number;
  amountLocal: number; // v měně instrumentu
  currency: string;
  feeCzk: number;
  lots: LotSale[]; // jen u prodejů: ze kterých nákupů
}

export interface Stage {
  date: string;
  isNow: boolean;
  trades: Trade[];
}

export interface Breach {
  key: string;
  drift: number;
  tolerance: number;
}

export interface Plan {
  clientName: string;
  status: PlanStatus;
  valuation: Valuation; // stav k datu ocenění
  horizonEnd: string;
  flows: CashFlow[]; // započtené (v horizontu)
  flowsLater: CashFlow[]; // za horizontem, jen pro informaci
  netFlowCzk: number;
  projectedTotalCzk: number;
  cashNeedCzk: number; // > 0: tolik hotovosti chybí, < 0: tolik je navíc (po cash flow, vůči cíli)
  breaches: Breach[]; // co zůstává mimo pásmo i po využití cash flow
  stages: Stage[];
  after: AssetRow[]; // váhy po provedení plánu (na projektovaném majetku)
  turnoverCzk: number;
  sellCzk: number;
  buyCzk: number;
  feesCzk: number;
  taxCzk: number;
  taxableGainCzk: number;
  exemptGainCzk: number;
  smallSalesExempt: boolean;
  costCzk: number; // poplatky + daň
  deferredUntil: string | null;
  cashShortfall: boolean; // plán by v čase nepokryl výběry
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function buildPlan(data: Dataset, clientName: string, s: Settings, opts: { allowDefer: boolean }): Plan {
  const val = valuate(data, clientName, s);
  const { client } = val;
  const asOf = data.asOf;
  const horizonEnd = addDays(asOf, s.horizonDays);
  const rate = taxRate(client.taxRegime, s);

  // 1. Cash flow v horizontu. Pohyby k datu ocenění a starší už jsou v zůstatcích.
  const future = data.cashFlows.filter((f) => f.client === clientName && f.date > asOf).sort((a, b) => a.date.localeCompare(b.date));
  const flows = future.filter((f) => f.date <= horizonEnd);
  const flowsLater = future.filter((f) => f.date > horizonEnd);
  const net = sum(flows.map((f) => f.amountCzk));
  const T = val.totalCzk + net; // projektovaný majetek
  const cash1 = val.cashCzk + net; // hotovost po cash flow, před obchody

  const tickers = data.instruments.map((i) => i.ticker);
  const value: Record<string, number> = {};
  for (const t of tickers) value[t] = sum(val.lots.filter((l) => l.ticker === t).map((l) => l.valueCzk));
  const target = (k: string) => client.targets[k] ?? 0;
  const gap = (t: string) => target(t) * T - value[t]; // > 0 podváženo, < 0 nadváženo
  const cashTarget = target(CASH) * T;
  const cashGap = cash1 - cashTarget; // > 0 přebytek
  const cashBand = (s.cashBandPp / 100) * T;
  const minTrade = (s.minTradePct / 100) * T;

  // 4. Výběr nákupů k prodeji: daňově nejlevnější napřed, nikdy pod cílovou váhu aktiva.
  const allocateSells = (need: number, capacity: Record<string, number>): LotSale[] => {
    const urgency = (t: string) => (capacity[t] ?? 0) / T / tolerance(t, target(t), s);
    const cands = val.lots
      .filter((l) => (capacity[l.ticker] ?? 0) > 0 && l.qty > 0)
      .map((l) => {
        const gainFrac = l.gainCzk / l.valueCzk;
        const soon =
          opts.allowDefer && !l.exemptNow && l.exemptFrom !== null && gainFrac > 0 && diffDays(asOf, l.exemptFrom) <= s.waitMaxDays;
        return {
          lot: l,
          when: soon ? (l.exemptFrom as string) : asOf,
          deferred: soon,
          taxPerCzk: l.exemptNow || soon ? 0 : gainFrac * rate, // zdanitelná ztráta vychází záporně → jde první
          order: l.exemptNow ? 0 : soon ? 1 : 2,
        };
      })
      .sort(
        (a, b) =>
          a.taxPerCzk - b.taxPerCzk ||
          a.order - b.order ||
          urgency(b.lot.ticker) - urgency(a.lot.ticker) ||
          a.lot.buyDate.localeCompare(b.lot.buyDate),
      );

    const cap = { ...capacity };
    const out: LotSale[] = [];
    let left = need;
    for (const c of cands) {
      if (left < 1) break;
      const l: LotView = c.lot;
      const want = Math.min(l.valueCzk, cap[l.ticker], left);
      if (want < 1) continue;
      let qty = want / l.unitCzk;
      qty = s.wholeUnits ? Math.round(qty) : Math.round(qty * 1e4) / 1e4;
      if (qty > l.qty * 0.9999) qty = l.qty;
      if (qty <= 0) continue;
      const czk = qty * l.unitCzk;
      out.push({
        ticker: l.ticker,
        buyDate: l.buyDate,
        qty,
        czk,
        gainCzk: (czk * l.gainCzk) / l.valueCzk,
        when: c.when,
        exempt: isExemptOn(l.exemptFrom, c.when),
        deferred: c.deferred,
      });
      cap[l.ticker] -= czk;
      left -= czk;
    }
    return out;
  };

  const over: Record<string, number> = {};
  const under: Record<string, number> = {};
  for (const t of tickers) {
    over[t] = Math.max(0, -gap(t));
    under[t] = Math.max(0, gap(t));
  }
  const soldBy = (sales: LotSale[], t: string) => sum(sales.filter((x) => x.ticker === t).map((x) => x.czk));

  // 2. Cash flow nejdřív.
  let mode: 'none' | 'cashflow' | 'rebalance' = 'none';
  let sales: LotSale[] = [];
  let buys: Record<string, number> = {};
  if (cash1 < -1 || cashGap < -cashBand) {
    sales = allocateSells(-cashGap, over);
    mode = 'cashflow';
  } else if (cashGap > cashBand) {
    const totalUnder = sum(Object.values(under));
    if (totalUnder > 0) for (const t of tickers) buys[t] = (cashGap * under[t]) / totalUnder;
    mode = 'cashflow';
  }

  // 3. Kontrola pásem po využití cash flow.
  const breaches: Breach[] = [];
  for (const t of tickers) {
    const drift = (value[t] + (buys[t] ?? 0) - soldBy(sales, t)) / T - target(t);
    const tol = tolerance(t, target(t), s);
    if (Math.abs(drift) > tol + 1e-9) breaches.push({ key: t, drift, tolerance: tol });
  }
  if (breaches.length > 0) {
    mode = 'rebalance';
    const big = (m: Record<string, number>) => Object.fromEntries(tickers.map((t) => [t, m[t] >= minTrade ? m[t] : 0]));
    let cap = big(over);
    if (cashGap + sum(Object.values(cap)) < 0) cap = over; // drobné prodeje jsou nutné na pokrytí hotovosti
    sales = allocateSells(sum(Object.values(cap)), cap);
    buys = { ...under };
  }
  for (const t of tickers) if ((buys[t] ?? 0) < minTrade) delete buys[t];

  // Nákupy nesmí přesáhnout dostupnou hotovost (přebytek + výnos z prodejů).
  const sellCzk = sum(sales.map((x) => x.czk));
  const avail = Math.max(0, cashGap + sellCzk);
  const wantBuys = sum(Object.values(buys));
  if (wantBuys > avail) for (const t of Object.keys(buys)) buys[t] *= avail / wantBuys;
  const unit = (t: string) => {
    const i = data.instruments.find((x) => x.ticker === t)!;
    const fx = i.currency === 'CZK' ? 1 : data.fx[i.currency];
    return { czk: i.price * fx, fx, currency: i.currency };
  };
  const totalBuys = sum(Object.values(buys));
  if (mode !== 'none' && sales.length === 0 && totalBuys < 1) mode = 'none';

  // 5. Časová osa: prodeje v den prodeje, nákupy co nejdřív, jak na ně bude hotovost
  //    (bez sahání na peníze, které budou potřeba na pozdější výběry).
  const inflow = new Map<string, number>([[asOf, 0]]);
  const add = (d: string, x: number) => inflow.set(d, (inflow.get(d) ?? 0) + x);
  for (const x of sales) add(x.when, x.czk);
  for (const f of flows) add(f.date, f.amountCzk);
  const dates = [...inflow.keys()].sort();
  const cum: number[] = [];
  dates.reduce((acc, d, i) => (cum[i] = acc + (inflow.get(d) as number)), val.cashCzk);

  const buyStages = new Map<string, number>(); // datum → CZK nákupů
  let done = 0;
  for (let i = 0; i < dates.length; i++) {
    const spendable = Math.min(...cum.slice(i)) - Math.max(0, cashTarget);
    const inc = Math.min(totalBuys, Math.max(0, spendable)) - done;
    const last = i === dates.length - 1;
    if (inc >= Math.min(minTrade, 1000) || (last && inc > 1)) {
      buyStages.set(dates[i], inc);
      done += inc;
    }
  }
  let cashShortfall = false;
  let bought = 0;
  dates.forEach((d, i) => {
    bought += buyStages.get(d) ?? 0;
    if (cum[i] - bought < -1) cashShortfall = true;
  });

  const fee = (czk: number) => Math.max(s.feeMinCzk, (s.feePct / 100) * czk);
  const stages: Stage[] = dates
    .map((date) => {
      const trades: Trade[] = [];
      for (const t of tickers) {
        const ls = sales.filter((x) => x.ticker === t && x.when === date);
        if (ls.length === 0) continue;
        const u = unit(t);
        const czk = sum(ls.map((x) => x.czk));
        trades.push({ side: 'sell', ticker: t, qty: sum(ls.map((x) => x.qty)), czk, amountLocal: czk / u.fx, currency: u.currency, feeCzk: fee(czk), lots: ls });
      }
      const stageBuy = buyStages.get(date) ?? 0;
      if (stageBuy > 0 && done > 0) {
        for (const t of tickers) {
          if (!buys[t]) continue;
          const u = unit(t);
          let qty = ((buys[t] / totalBuys) * stageBuy) / u.czk;
          qty = s.wholeUnits ? Math.floor(qty) : Math.round(qty * 1e4) / 1e4;
          if (qty <= 0) continue;
          const czk = qty * u.czk;
          trades.push({ side: 'buy', ticker: t, qty, czk, amountLocal: czk / u.fx, currency: u.currency, feeCzk: fee(czk), lots: [] });
        }
      }
      return { date, isNow: date === asOf, trades };
    })
    .filter((st) => st.trades.length > 0);

  const allTrades = stages.flatMap((st) => st.trades);
  const buyCzk = sum(allTrades.filter((t) => t.side === 'buy').map((t) => t.czk));
  const feesCzk = sum(allTrades.map((t) => t.feeCzk));
  const tax = taxOnSales(
    sales.map((x) => ({ proceedsCzk: x.czk, gainCzk: x.gainCzk, exempt: x.exempt })),
    client.taxRegime,
    s,
  );

  // Váhy po zásahu.
  const boughtBy = (t: string) => sum(allTrades.filter((x) => x.side === 'buy' && x.ticker === t).map((x) => x.czk));
  const after: AssetRow[] = val.assets.map((a) => {
    const v = a.key === CASH ? cash1 + sellCzk - buyCzk : value[a.key] + boughtBy(a.key) - soldBy(sales, a.key);
    const weight = T > 0 ? v / T : 0;
    return { ...a, valueCzk: v, weight, drift: weight - a.target, breached: Math.abs(weight - a.target) > a.tolerance + 1e-9 };
  });

  const deferredDates = sales.filter((x) => x.deferred).map((x) => x.when).sort();
  const deferredUntil = deferredDates.length ? deferredDates[deferredDates.length - 1] : null;

  return {
    clientName,
    status: mode === 'none' ? 'none' : deferredUntil ? 'wait' : mode,
    valuation: val,
    horizonEnd,
    flows,
    flowsLater,
    netFlowCzk: net,
    projectedTotalCzk: T,
    cashNeedCzk: -cashGap,
    breaches,
    stages,
    after,
    turnoverCzk: sellCzk + buyCzk,
    sellCzk,
    buyCzk,
    feesCzk,
    taxCzk: tax.taxCzk,
    taxableGainCzk: tax.taxableGainCzk,
    exemptGainCzk: tax.exemptGainCzk,
    smallSalesExempt: tax.smallSalesExempt,
    costCzk: feesCzk + tax.taxCzk,
    deferredUntil,
    cashShortfall,
  };
}

export interface Recommendation {
  plan: Plan; // doporučená varianta
  nowPlan: Plan; // vše provést hned
  waitPlan: Plan | null; // varianta s odloženým prodejem, pokud existuje
  taxSavedByWaitingCzk: number;
}

/**
 * Doporučení: čekat na osvobození se vyplatí, když se tím ušetří aspoň `waitMinSavingCzk`
 * a plán přitom v čase pokryje všechny výběry. Jinak provést vše hned.
 */
export function recommend(data: Dataset, clientName: string, s: Settings): Recommendation {
  const nowPlan = buildPlan(data, clientName, s, { allowDefer: false });
  if (s.waitMaxDays <= 0) return { plan: nowPlan, nowPlan, waitPlan: null, taxSavedByWaitingCzk: 0 };
  const w = buildPlan(data, clientName, s, { allowDefer: true });
  if (!w.deferredUntil) return { plan: nowPlan, nowPlan, waitPlan: null, taxSavedByWaitingCzk: 0 };
  const saved = nowPlan.taxCzk - w.taxCzk;
  const worthIt = saved >= s.waitMinSavingCzk && !w.cashShortfall;
  return { plan: worthIt ? w : nowPlan, nowPlan, waitPlan: w, taxSavedByWaitingCzk: saved };
}

export interface ExemptionEvent {
  clientName: string;
  ticker: string;
  buyDate: string;
  exemptFrom: string;
  days: number;
  valueCzk: number;
  taxSavedCzk: number; // daň, která po tomto datu odpadne (při prodeji celé pozice)
}

/** Daňový kalendář: které pozice se v nejbližší době osvobodí. */
export function exemptionCalendar(data: Dataset, s: Settings, withinDays = 365): ExemptionEvent[] {
  return data.clients
    .flatMap((c) =>
      valuate(data, c.name, s)
        .lots.filter((l) => !l.exemptNow && l.exemptFrom !== null && l.gainCzk > 0 && (l.daysToExempt as number) <= withinDays)
        .map((l) => ({
          clientName: c.name,
          ticker: l.ticker,
          buyDate: l.buyDate,
          exemptFrom: l.exemptFrom as string,
          days: l.daysToExempt as number,
          valueCzk: l.valueCzk,
          taxSavedCzk: l.taxIfSoldNowCzk,
        })),
    )
    .sort((a, b) => a.exemptFrom.localeCompare(b.exemptFrom));
}
