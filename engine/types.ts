// Datový model. Žádná závislost na UI ani na Excelu – jen čistá data.

export type TaxRegime = 'FO' | 'PO'; // FO = fyzická osoba, PO = právnická osoba (s.r.o.)

/** Klíč, pod kterým se v cílových vahách a přehledech vede hotovost. */
export const CASH = 'CASH';

export interface Instrument {
  ticker: string;
  name: string;
  isin: string;
  currency: string;
  assetClass: string;
  price: number; // v měně instrumentu
}

export interface Client {
  name: string;
  profile: string;
  taxRegime: TaxRegime;
  /** Cílové váhy jako podíl 0–1, klíčem je ticker nebo CASH. Součet = 1. */
  targets: Record<string, number>;
  note: string;
}

/** Jeden nákup = jedna daňová pozice. */
export interface Lot {
  client: string;
  ticker: string;
  buyDate: string; // ISO YYYY-MM-DD
  qty: number;
  buyPrice: number; // v měně instrumentu
}

export interface CashBalance {
  client: string;
  currency: string;
  amount: number;
}

export interface CashFlow {
  client: string;
  date: string; // ISO
  amountCzk: number; // kladné = vklad, záporné = výběr
  note: string;
}

export interface Dataset {
  asOf: string; // datum ocenění, ISO
  instruments: Instrument[];
  fx: Record<string, number>; // CZK za 1 jednotku měny; CZK = 1
  clients: Client[];
  lots: Lot[];
  cash: CashBalance[];
  cashFlows: CashFlow[];
}

/** Všechna pravidla na jednom místě. Výchozí hodnoty viz settings.ts. */
export interface Settings {
  absBandPp: number; // absolutní pásmo v p. b.
  relBandPct: number; // relativní pásmo v % cílové váhy
  cashBandPp: number; // tolerance hotovosti v p. b. portfolia
  minTradePct: number; // obchody menší než toto % portfolia se nedělají
  horizonDays: number; // jak daleko dopředu se započítávají vklady a výběry
  feePct: number; // poplatek brokera v % objemu
  feeMinCzk: number; // minimální poplatek za obchod
  taxRateFO: number; // %
  taxRatePO: number; // %
  timeTestYears: number; // časový test pro FO
  smallSalesLimitCzk: number; // osvobození FO při ročních příjmech z prodeje CP do limitu
  waitMaxDays: number; // jak dlouho je ochota čekat na osvobození
  waitMinSavingCzk: number; // minimální úspora daně, kvůli které se čeká
  wholeUnits: boolean; // true = jen celé kusy, false = frakce
  stageParts: number; // do kolika částí lze obchody rozložit v čase (1 = nerozkládat)
  stageIntervalDays: number; // odstup mezi částmi
  stageMinPct: number; // rozložení se doporučí, když čistý nákup z hotovosti přesáhne toto % portfolia
  shockPct: number; // pohyb trhu ve scénáři „co kdyby“ při porovnání variant, v %
}
