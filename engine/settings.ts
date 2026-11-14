import type { Settings } from './types';

/** Výchozí pravidla. Zdůvodnění je v docs/POPIS.md. */
export const DEFAULT_SETTINGS: Settings = {
  absBandPp: 5,
  relBandPct: 25,
  cashBandPp: 1,
  minTradePct: 0.5,
  horizonDays: 90,
  feePct: 0.1,
  feeMinCzk: 50,
  taxRateFO: 15,
  taxRatePO: 21,
  timeTestYears: 3,
  smallSalesLimitCzk: 100_000,
  waitMaxDays: 90,
  waitMinSavingCzk: 10_000,
  wholeUnits: false,
};
