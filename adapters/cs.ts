// České texty a formátování. Jádro vrací čísla a kódy, tady se z nich stávají věty.
// Používá to webová aplikace i skript, který generuje docs/VYSTUP.md.

import { CASH, shockEffect, type Plan, type Recommendation, type Settings, type Trade, type VariantKey } from '../engine';

const nf0 = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nfQty = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 4 });
const nf2 = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const czk = (x: number) => `${nf0.format(Math.round(x))} Kč`;
export const mil = (x: number) => `${nf2.format(x / 1e6)} mil. Kč`;
export const pct = (x: number) => `${nf1.format(x * 100)} %`;
export const pp = (x: number) => {
  const r = Math.round(x * 1000) / 10; // na desetinu p. b., aby nevznikalo „−0,0“
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${nf1.format(Math.abs(r))} p. b.`;
};
export const qty = (x: number) => nfQty.format(x);
export const money = (x: number, cur: string) => `${nf2.format(x)} ${cur}`;
export const day = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}. ${m}. ${y}`;
};
export const dayShort = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d}. ${m}.`;
};
/** Částka se znaménkem, pro rozdíly: „+1 000 Kč“, „−250 Kč“, „0 Kč“. */
export const signed = (x: number) => {
  const r = Math.round(x);
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${nf0.format(Math.abs(r))} Kč`;
};
export const label = (key: string) => (key === CASH ? 'Hotovost' : key);

/** Název varianty provedení pro konkrétní plán. */
export function variantTitle(p: Plan): string {
  if (p.variant === 'staged') return `Rozložit do ${p.parts} částí`;
  if (p.variant === 'wait' && p.deferredUntil) return `Počkat do ${day(p.deferredUntil)}`;
  return 'Všechno hned';
}
export const VARIANT_LABEL: Record<VariantKey, string> = { now: 'všechno hned', wait: 'počkat na časový test', staged: 'rozložit v čase' };

/** Den, kdy je plán celý proveden. */
export const doneDate = (p: Plan) => (p.stages.length ? p.stages[p.stages.length - 1].date : null);
export const tradeCount = (p: Plan) => p.stages.reduce((a, st) => a + st.trades.length, 0);

/** Obchody jedné etapy jednou větou: „Prodej VWCE 2 148 429 Kč · nákup EUNA, IGLN 1 898 429 Kč“. */
export function tradesText(trades: Trade[]): string {
  const part = (side: Trade['side'], word: string) => {
    const xs = trades.filter((t) => t.side === side);
    return xs.length ? `${word} ${xs.map((t) => t.ticker).join(', ')} ${czk(xs.reduce((a, t) => a + t.czk, 0))}` : '';
  };
  const out = [part('sell', 'prodej'), part('buy', 'nákup')].filter(Boolean).join(' · ');
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export type StatusKind = 'none' | 'invest' | 'raise' | 'rebalance' | 'wait';

/** Stav pro přehled. „cashflow“ z jádra se dělí podle toho, jestli se nakupuje, nebo prodává. */
export function statusKind(p: Plan): StatusKind {
  if (p.status !== 'cashflow') return p.status;
  return p.sellCzk > 0 ? 'raise' : 'invest';
}

export const STATUS_LABEL: Record<StatusKind, string> = {
  none: 'Bez zásahu',
  invest: 'Investovat hotovost',
  raise: 'Připravit hotovost',
  rebalance: 'Rebalancovat',
  wait: 'Počkat s prodejem',
};

/** Pořadí naléhavosti pro řazení přehledu. */
export const STATUS_ORDER: Record<StatusKind, number> = { rebalance: 0, wait: 1, raise: 2, invest: 3, none: 4 };

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} a ${xs[xs.length - 1]}`);
const tickersOf = (p: Plan, side: 'buy' | 'sell') => [...new Set(p.stages.flatMap((s) => s.trades.filter((t) => t.side === side).map((t) => t.ticker)))];

/** Jedna věta do přehledu. */
export function summary(p: Plan): string {
  const sells = tickersOf(p, 'sell');
  const buys = tickersOf(p, 'buy');
  const staged = p.variant === 'staged' ? ` Rozloženo do ${p.parts} částí, poslední ${day(doneDate(p)!)}.` : '';
  switch (statusKind(p)) {
    case 'none':
      return 'Všechna aktiva jsou v pásmu.';
    case 'invest':
      return `Nakoupit ${list(buys)} za ${czk(p.buyCzk)}, bez prodeje.${staged}`;
    case 'raise':
      return `Prodat ${list(sells)} za ${czk(p.sellCzk)} na plánované výběry.${staged}`;
    case 'rebalance':
      return `Prodat ${list(sells)} za ${czk(p.sellCzk)}, nakoupit ${list(buys)}.${staged}`;
    case 'wait':
      return `Část hned, hlavní prodej ${list(sells)} až ${day(p.deferredUntil!)} bez daně.`;
  }
}

/** Zdůvodnění krok za krokem – proč nástroj navrhuje právě tohle. */
export function explain(r: Recommendation, s: Settings): string[] {
  const p = r.plan;
  const v = p.valuation;
  const out: string[] = [];
  const kind = statusKind(p);

  if (p.flows.length > 0) {
    const dep = p.flows.filter((f) => f.amountCzk > 0);
    const wd = p.flows.filter((f) => f.amountCzk < 0);
    const parts: string[] = [];
    if (dep.length) parts.push(`vklady ${czk(dep.reduce((a, f) => a + f.amountCzk, 0))}`);
    if (wd.length) parts.push(`výběry ${czk(-wd.reduce((a, f) => a + f.amountCzk, 0))}`);
    out.push(`Do ${day(p.horizonEnd)} (horizont ${s.horizonDays} dnů) jsou naplánované ${parts.join(' a ')}. Cílové váhy se počítají z majetku po těchto pohybech: ${czk(p.projectedTotalCzk)}.`);
  }

  if (kind === 'none') {
    const w = v.worst;
    out.push(`Největší odchylka je ${label(w.key)} ${pp(w.drift)} při pásmu ±${pp(w.tolerance).replace('+', '')}. Nic není mimo toleranci, obchod by jen stál poplatky.`);
  }

  if (p.status !== 'none' && p.cashNeedCzk > 0 && p.sellCzk > 0) {
    const cashT = v.client.targets[CASH] ?? 0;
    out.push(
      `Po výběrech chybí ${czk(p.cashNeedCzk)} hotovosti${cashT > 0 ? ` (včetně doplnění rezervy na cílových ${pct(cashT)})` : ''}. Prodává se jen z aktiv nad cílovou vahou, takže výběr zároveň vrací portfolio k cíli.`,
    );
  }
  if (p.status !== 'none' && p.cashNeedCzk < 0 && p.buyCzk > 0) {
    out.push(`Volná hotovost ${czk(-p.cashNeedCzk)} jde do podvážených aktiv v poměru jejich podvážení.`);
  }

  if (p.breaches.length > 0) {
    const b = p.breaches.map((x) => `${label(x.key)} ${pp(x.drift)} (pásmo ±${pp(x.tolerance).replace('+', '')})`);
    out.push(`Ani po využití cash flow není v pásmu: ${list(b)}. Proto se portfolio dorovnává na cílové váhy.`);
  } else if (kind === 'invest' || kind === 'raise') {
    out.push('Po těchto obchodech je vše v tolerančním pásmu, další prodej není potřeba.');
  }

  if (p.sellCzk > 0) {
    if (v.client.taxRegime === 'PO') {
      out.push(`Právnická osoba nemá časový test: zdanitelný zisk ${czk(p.taxableGainCzk)} × ${s.taxRatePO} % = daň ${czk(p.taxCzk)}.`);
    } else if (p.smallSalesExempt) {
      out.push(`Prodeje nepřesáhnou ${czk(s.smallSalesLimitCzk)} za rok, zisk je proto osvobozen.`);
    } else if (p.taxCzk < 1) {
      out.push(`Všechny prodávané kusy jsou v den prodeje držené déle než ${s.timeTestYears} roky (osvobozený zisk ${czk(p.exemptGainCzk)}), daň je 0 Kč.`);
    } else {
      out.push(`Osvobozené kusy nestačí. Zdanitelný zisk ${czk(p.taxableGainCzk)} × ${s.taxRateFO} % = daň ${czk(p.taxCzk)}; berou se nákupy s nejnižším ziskem.`);
    }
  } else if (p.buyCzk > 0 && v.client.taxRegime === 'PO') {
    out.push('Jen nákupy, žádný prodej: u s.r.o. by se každý prodej se ziskem danil 21 %.');
  }

  if (r.waitPlan) {
    const d = r.waitPlan.deferredUntil!;
    const lots = r.waitPlan.stages.flatMap((st) => st.trades.flatMap((t) => t.lots.filter((l) => l.deferred)));
    const what = lots.map((l) => `${qty(l.qty)} ks ${l.ticker} z nákupu ${day(l.buyDate)}`);
    const waits = p === r.waitPlan || (p.variant === 'staged' && p.deferredUntil !== null);
    if (waits) {
      const even =
        r.waitBreakEvenDrop === null
          ? ''
          : ` Vyplatí se to, dokud ${list([...new Set(lots.map((l) => l.ticker))])} do té doby neztratí víc než ${pct(r.waitBreakEvenDrop)} proti nakupovaným aktivům.`;
      out.push(
        `Počkat se vyplatí: ${list(what)} splní časový test ${day(d)}. Prodej hned by stál na dani ${czk(r.nowPlan.taxCzk)}, po tomto datu ${czk(r.waitPlan.taxCzk)}. Osvobozené kusy se prodávají dřív.${even}`,
      );
    } else if (r.waitPlan.cashShortfall) {
      out.push(`Čekání na osvobození (${day(d)}) by ušetřilo ${czk(r.taxSavedByWaitingCzk)}, ale hotovost by nestačila na výběry před tímto datem. Prodává se hned.`);
    } else if (r.taxSavedByWaitingCzk < s.waitMinSavingCzk) {
      out.push(`Čekáním do ${day(d)} by se ušetřilo jen ${czk(r.taxSavedByWaitingCzk)}, méně než hranice ${czk(s.waitMinSavingCzk)}. Prodává se hned.`);
    } else {
      out.push(`Čekáním do ${day(d)} by se ušetřilo ${czk(r.taxSavedByWaitingCzk)} na dani. Zvolena je ale varianta prodat hned.`);
    }
  }

  if (p.variant === 'staged') {
    const last = p.partDates[p.partDates.length - 1];
    const why =
      r.recommended === 'staged'
        ? `Čistý nákup z hotovosti je ${pct(r.netBuyShare)} portfolia, víc než hranice ${s.stageMinPct} %. Koupit všechno v jeden den by byla sázka na jediný kurz, proto je zásah rozložen`
        : 'Zvolena je rozložená varianta: zásah je rozdělen';
    out.push(`${why} do ${p.parts} částí po ${s.stageIntervalDays} dnech, poslední ${day(last)}.`);
    const e = shockEffect(p, r.nowPlan, s.shockPct);
    if (Math.abs(e.downCzk) >= 1) {
      const word = (x: number) => `o ${czk(Math.abs(x))} ${x > 0 ? 'lépe' : 'hůř'}`;
      out.push(
        `Co rozložení obnáší: kdyby trh po první části klesl o ${s.shockPct} %, vyjde ${word(e.downCzk)} než všechno hned; kdyby o ${s.shockPct} % vzrostl, ${word(e.upCzk)}. Do ${day(last)} zůstává část portfolia mimo cílové váhy.`,
      );
    }
  } else if (r.recommended === 'staged') {
    out.push(`Nástroj doporučuje zásah rozložit (čistý nákup z hotovosti je ${pct(r.netBuyShare)} portfolia). Zvolena je ale varianta ${VARIANT_LABEL[p.variant]}.`);
  } else if (r.stagedPlan && p.status !== 'none') {
    out.push(
      r.netBuyShare * 100 >= 0.05
        ? `Rozložení v čase se nedoporučuje: čistý nákup z hotovosti je jen ${pct(r.netBuyShare)} portfolia, méně než hranice ${s.stageMinPct} %.`
        : 'Rozložení v čase se nedoporučuje: do trhu se nepřidává nová hotovost a odklad by jen držel portfolio déle mimo cíl.',
    );
  }

  if (p.flowsLater.length > 0) {
    const f = p.flowsLater.map((x) => `${x.amountCzk > 0 ? 'vklad' : 'výběr'} ${czk(Math.abs(x.amountCzk))} ${day(x.date)}`);
    out.push(`Za horizontem, zatím nezapočteno: ${list(f)}.`);
  }
  if (p.cashShortfall && p === r.nowPlan) out.push('Pozor: hotovost v čase nepokryje všechny výběry, plán je potřeba upravit ručně.');
  return out;
}
