// Návrh zásahu pro jednoho klienta.
//
// Postup (podrobně v docs/POPIS.md):
//   1. Započti vklady a výběry v horizontu → „projektované“ portfolio.
//   2. Cash flow nejdřív: přebytek hotovosti nakup do podvážených aktiv,
//      chybějící hotovost získej prodejem nadvážených aktiv.
//   3. Je i potom něco mimo toleranční pásmo? → dorovnej vše na cíl.
//   4. Co prodat: po jednotlivých nákupech, daňově nejlevnější napřed.
//   5. Kdy: prodej nákupu, který bude brzy osvobozen, lze odložit (varianta „počkat“),
//      a celý zásah lze rozložit do několika částí v čase (varianta „rozložit“).

import { addDays, diffDays } from './dates';
import { isExemptOn, taxOnSales, taxRate } from './tax';
import { CASH, type CashFlow, type Dataset, type Settings } from './types';
import { tolerance, valuate, type AssetRow, type LotView, type Valuation } from './valuation';

export type PlanStatus = 'none' | 'cashflow' | 'rebalance' | 'wait';
/** Způsob provedení: vše hned, počkat na časový test, nebo rozložit do částí. */
export type VariantKey = 'now' | 'wait' | 'staged';

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
  variant: VariantKey;
  parts: number; // do kolika částí je zásah rozložen (1 = nerozložen)
  partDates: string[]; // data jednotlivých částí, prázdné když není rozložen
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

export interface BuildOptions {
  allowDefer: boolean; // odložit prodej nákupů, které budou brzy osvobozené
  parts?: number; // rozložit do tolika částí
  intervalDays?: number; // odstup částí
}

export function buildPlan(data: Dataset, clientName: string, s: Settings, opts: BuildOptions): Plan {
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

  // 5a. Rozložení v čase. Každý prodej se rozdělí na P stejných částí po `interval` dnech.
  //     Nákup, který čeká na časový test, se přesune do první části po osvobození.
  //     Kdyby kvůli rozložení chyběla hotovost na výběr, potřebná část prodeje se předsune.
  const P = mode === 'none' ? 1 : Math.max(1, Math.floor(opts.parts ?? 1));
  const interval = Math.max(1, Math.floor(opts.intervalDays ?? 30));
  const partDates = Array.from({ length: P }, (_, k) => addDays(asOf, k * interval));
  if (P > 1) {
    const lotOf = (x: LotSale) => val.lots.find((l) => l.ticker === x.ticker && l.buyDate === x.buyDate) as LotView;
    const piece = (x: LotSale, qty: number, when: string): LotSale => {
      const l = lotOf(x);
      const czk = qty * l.unitCzk;
      const exempt = isExemptOn(l.exemptFrom, when);
      return { ...x, qty, czk, gainCzk: (czk * l.gainCzk) / l.valueCzk, when, exempt, deferred: x.deferred && exempt };
    };
    const merge = (xs: LotSale[]) => {
      const m = new Map<string, LotSale>();
      for (const x of xs) {
        const k = `${x.ticker}|${x.buyDate}|${x.when}`;
        const o = m.get(k);
        m.set(k, o ? piece(x, o.qty + x.qty, x.when) : x);
      }
      return [...m.values()];
    };

    const split: LotSale[] = [];
    for (const x of sales) {
      let left = x.qty;
      partDates.forEach((d, k) => {
        const when = d >= x.when ? d : (partDates.find((e) => e >= x.when) ?? x.when);
        let q = x.qty / P;
        q = k === P - 1 ? left : s.wholeUnits ? Math.floor(q) : Math.round(q * 1e4) / 1e4;
        q = Math.min(q, left);
        left -= q;
        if (q > 0) split.push(piece(x, q, when));
      });
    }
    sales = merge(split);

    for (let guard = 0; guard < 100; guard++) {
      const ds = [...new Set([asOf, ...flows.map((f) => f.date), ...sales.map((x) => x.when)])].sort();
      let cash = val.cashCzk;
      let short: { date: string; need: number } | null = null;
      for (const d of ds) {
        cash += sum(flows.filter((f) => f.date === d).map((f) => f.amountCzk)) + sum(sales.filter((x) => x.when === d).map((x) => x.czk));
        if (cash < -1) {
          short = { date: d, need: -cash };
          break;
        }
      }
      if (!short) break;
      const until = short.date;
      const to = [...partDates].reverse().find((d) => d <= until) ?? asOf;
      const losesExemption = (x: LotSale) => (x.exempt && !isExemptOn(lotOf(x).exemptFrom, to) ? 1 : 0);
      const later = sales.filter((x) => x.when > until).sort((a, b) => losesExemption(a) - losesExemption(b) || a.when.localeCompare(b.when));
      if (later.length === 0) break; // není co předsunout, plán zůstane označený jako nepokrytý
      const next = sales.filter((x) => x.when <= until);
      let need = short.need;
      for (const x of later) {
        if (need < 1) {
          next.push(x);
          continue;
        }
        const unitCzk = lotOf(x).unitCzk;
        let q = need / unitCzk;
        q = Math.min(x.qty, s.wholeUnits ? Math.ceil(q) : Math.ceil(q * 1e4) / 1e4);
        next.push(piece(x, q, to));
        if (x.qty - q > 1e-9) next.push(piece(x, x.qty - q, x.when));
        need -= q * unitCzk;
      }
      sales = merge(next);
    }
  }

  // 5b. Časová osa: prodeje v den prodeje, nákupy co nejdřív, jak na ně bude hotovost
  //     (bez sahání na peníze, které budou potřeba na pozdější výběry). Při rozložení
  //     se s každou částí uvolní jen poměrný díl nákupů.
  const inflow = new Map<string, number>([[asOf, 0]]);
  const add = (d: string, x: number) => inflow.set(d, (inflow.get(d) ?? 0) + x);
  if (P > 1 && totalBuys >= 1) for (const d of partDates) add(d, 0);
  const released = (d: string) => (P <= 1 ? totalBuys : (totalBuys * partDates.filter((x) => x <= d).length) / P);
  for (const x of sales) add(x.when, x.czk);
  for (const f of flows) add(f.date, f.amountCzk);
  const dates = [...inflow.keys()].sort();
  const cum: number[] = [];
  dates.reduce((acc, d, i) => (cum[i] = acc + (inflow.get(d) as number)), val.cashCzk);

  const buyStages = new Map<string, number>(); // datum → CZK nákupů
  let done = 0;
  for (let i = 0; i < dates.length; i++) {
    const spendable = Math.min(...cum.slice(i)) - Math.max(0, cashTarget);
    const inc = Math.min(released(dates[i]), Math.max(0, spendable)) - done;
    const last = i === dates.length - 1;
    // Etapa nákupů menší než nejmenší obchod se nevyplatí (poplatky); počká na další datum.
    if (inc >= minTrade || (last && inc > 1)) {
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
    status: mode === 'none' ? 'none' : deferredUntil && P <= 1 ? 'wait' : mode,
    variant: P > 1 ? 'staged' : opts.allowDefer ? 'wait' : 'now',
    parts: P,
    partDates: P > 1 ? partDates : [],
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
  recommended: VariantKey;
  nowPlan: Plan; // vše provést hned
  waitPlan: Plan | null; // varianta s odloženým prodejem, pokud existuje
  stagedPlan: Plan | null; // varianta rozložená do částí, pokud se od základní liší
  taxSavedByWaitingCzk: number;
  /** O kolik smí odložené aktivum do data prodeje zlevnit, aby se čekání ještě vyplatilo (podíl 0–1). */
  waitBreakEvenDrop: number | null;
  /** Čistý nákup z hotovosti (nákupy − prodeje) jako podíl portfolia. Podle něj se doporučuje rozložení. */
  netBuyShare: number;
}

/**
 * Doporučení ve dvou krocích.
 *   1. Čekat na osvobození se vyplatí, když se tím ušetří aspoň `waitMinSavingCzk`
 *      a plán přitom v čase pokryje všechny výběry. Jinak provést vše hned.
 *   2. Rozložit do částí se doporučí jen tam, kde se mění expozice vůči trhu: když čistý
 *      nákup z hotovosti přesáhne `stageMinPct` % portfolia. Prodej jednoho aktiva a nákup
 *      druhého riziko vstupu do trhu nenese a jeho odklad by jen držel portfolio mimo cíl.
 */
export function recommend(data: Dataset, clientName: string, s: Settings): Recommendation {
  const nowPlan = buildPlan(data, clientName, s, { allowDefer: false });
  let waitPlan: Plan | null = null;
  let saved = 0;
  let base = nowPlan;
  if (s.waitMaxDays > 0) {
    const w = buildPlan(data, clientName, s, { allowDefer: true });
    if (w.deferredUntil) {
      waitPlan = w;
      saved = nowPlan.taxCzk - w.taxCzk;
      if (saved >= s.waitMinSavingCzk && !w.cashShortfall) base = w;
    }
  }

  let stagedPlan: Plan | null = null;
  if (s.stageParts >= 2 && s.stageIntervalDays > 0 && base.status !== 'none') {
    const st = buildPlan(data, clientName, s, { allowDefer: base === waitPlan, parts: s.stageParts, intervalDays: s.stageIntervalDays });
    const sameDates = st.stages.map((x) => x.date).join() === base.stages.map((x) => x.date).join();
    if (!sameDates && (!st.cashShortfall || base.cashShortfall)) stagedPlan = st;
  }
  const netBuyShare = base.projectedTotalCzk > 0 ? (base.buyCzk - base.sellCzk) / base.projectedTotalCzk : 0;
  const plan = stagedPlan && netBuyShare * 100 >= s.stageMinPct ? stagedPlan : base;

  const deferredCzk = waitPlan ? sum(waitPlan.stages.flatMap((st) => st.trades.flatMap((t) => t.lots.filter((l) => l.deferred).map((l) => l.czk)))) : 0;
  return {
    plan,
    recommended: plan.variant,
    nowPlan,
    waitPlan,
    stagedPlan,
    taxSavedByWaitingCzk: saved,
    waitBreakEvenDrop: deferredCzk > 0 && saved > 0 ? saved / deferredCzk : null,
    netBuyShare,
  };
}

/** Čistý nákup (nákupy − prodeje) v etapách po datu ocenění, v CZK při dnešních cenách. */
export const laterNetBuyCzk = (p: Plan) =>
  sum(p.stages.filter((st) => !st.isNow).flatMap((st) => st.trades.map((t) => (t.side === 'buy' ? t.czk : -t.czk))));

/**
 * Scénář bez pravděpodobností: trh se hned po dnešních obchodech posune o `shockPct` %
 * (všechny instrumenty stejně) a zbytek plánu se provede za nové ceny. Vrací rozdíl
 * výsledku proti variantě `ref` (obvykle „vše hned“); kladné číslo = `p` vyjde lépe.
 * Kdo nakupuje později, při poklesu nakoupí levněji a při růstu dráž.
 */
export function shockEffect(p: Plan, ref: Plan, shockPct: number): { downCzk: number; upCzk: number } {
  const later = laterNetBuyCzk(p) - laterNetBuyCzk(ref);
  const x = (later * shockPct) / 100;
  return { downCzk: x, upCzk: -x };
}
