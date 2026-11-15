// Ocenění portfolia: hodnoty, váhy, odchylky od cíle a toleranční pásma.

import { diffDays } from './dates';
import { exemptFrom, isExemptOn, taxRate } from './tax';
import { CASH, type Client, type Dataset, type Settings } from './types';

export interface LotView {
  ticker: string;
  buyDate: string;
  qty: number;
  buyPrice: number;
  currency: string;
  unitCzk: number; // dnešní cena 1 kusu v CZK
  valueCzk: number;
  costCzk: number; // nákupní cena přepočtená dnešním kurzem (zjednodušení ze zadání)
  gainCzk: number;
  exemptFrom: string | null; // od kdy je prodej osvobozen (FO), null = nikdy (PO)
  exemptNow: boolean;
  daysToExempt: number | null;
  taxIfSoldNowCzk: number; // daň při prodeji celé pozice k datu ocenění
}

export interface AssetRow {
  key: string; // ticker nebo CASH
  name: string;
  valueCzk: number;
  weight: number; // 0–1
  target: number; // 0–1
  drift: number; // weight − target
  tolerance: number; // šířka pásma na jednu stranu, 0–1
  breached: boolean;
}

export interface Valuation {
  client: Client;
  totalCzk: number;
  cashCzk: number;
  assets: AssetRow[]; // ETF v pořadí listu Instrumenty, hotovost poslední
  lots: LotView[];
  worst: AssetRow; // aktivum nejdál od cíle v poměru k pásmu
}

/**
 * Toleranční pásmo „5/25“: menší z absolutní hranice (5 p. b.) a relativní hranice (25 % cíle).
 * Hotovost a aktiva s nulovým cílem mají vlastní úzké pásmo.
 */
export function tolerance(key: string, target: number, s: Settings): number {
  if (key === CASH || target <= 0) return s.cashBandPp / 100;
  return Math.min(s.absBandPp / 100, (s.relBandPct / 100) * target);
}

/**
 * Kolik korun je mimo cílovou alokaci: částka, kterou by bylo potřeba přesunout,
 * aby váhy seděly přesně na cíl (součet nadvážení; podvážení je stejně velké).
 */
export const offTargetCzk = (assets: AssetRow[], totalCzk: number) => totalCzk * assets.reduce((a, x) => a + Math.max(0, x.drift), 0);

export function getClient(data: Dataset, name: string): Client {
  const c = data.clients.find((x) => x.name === name);
  if (!c) throw new Error(`Neznámý klient: ${name}`);
  return c;
}

export function valuate(data: Dataset, clientName: string, s: Settings): Valuation {
  const client = getClient(data, clientName);
  const fx = (cur: string) => {
    const r = cur === 'CZK' ? 1 : data.fx[cur];
    if (!r) throw new Error(`Chybí kurz pro měnu ${cur}`);
    return r;
  };
  const rate = taxRate(client.taxRegime, s);

  const lots: LotView[] = data.lots
    .filter((l) => l.client === clientName)
    .map((l) => {
      const ins = data.instruments.find((i) => i.ticker === l.ticker);
      if (!ins) throw new Error(`Neznámý instrument: ${l.ticker}`);
      const unitCzk = ins.price * fx(ins.currency);
      const valueCzk = l.qty * unitCzk;
      const costCzk = l.qty * l.buyPrice * fx(ins.currency);
      const ef = exemptFrom(l.buyDate, client.taxRegime, s);
      const exemptNow = isExemptOn(ef, data.asOf);
      const gainCzk = valueCzk - costCzk;
      return {
        ticker: l.ticker,
        buyDate: l.buyDate,
        qty: l.qty,
        buyPrice: l.buyPrice,
        currency: ins.currency,
        unitCzk,
        valueCzk,
        costCzk,
        gainCzk,
        exemptFrom: ef,
        exemptNow,
        daysToExempt: ef === null ? null : Math.max(0, diffDays(data.asOf, ef)),
        taxIfSoldNowCzk: exemptNow ? 0 : Math.max(0, gainCzk) * rate,
      };
    });

  const cashCzk = data.cash.filter((c) => c.client === clientName).reduce((a, c) => a + c.amount * fx(c.currency), 0);
  const totalCzk = cashCzk + lots.reduce((a, l) => a + l.valueCzk, 0);

  const row = (key: string, name: string, valueCzk: number): AssetRow => {
    const target = client.targets[key] ?? 0;
    const weight = totalCzk > 0 ? valueCzk / totalCzk : 0;
    const tol = tolerance(key, target, s);
    return { key, name, valueCzk, weight, target, drift: weight - target, tolerance: tol, breached: Math.abs(weight - target) > tol };
  };

  const assets = data.instruments
    .map((i) => row(i.ticker, i.assetClass, lots.filter((l) => l.ticker === i.ticker).reduce((a, l) => a + l.valueCzk, 0)))
    .filter((r) => r.target > 0 || r.valueCzk > 0);
  assets.push(row(CASH, 'Hotovost', cashCzk));

  const worst = assets.reduce((a, b) => (Math.abs(b.drift) / b.tolerance > Math.abs(a.drift) / a.tolerance ? b : a));
  return { client, totalCzk, cashCzk, assets, lots, worst };
}
