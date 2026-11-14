// Testy na přiložených datech. Očekávané hodnoty jsou spočítané ručně / nezávisle v Pythonu.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseWorkbook } from '../adapters/excel';
import { CASH, DEFAULT_SETTINGS as S, exemptFrom, recommend, taxOnSales, tolerance, valuate } from './index';

const { dataset: data, warnings } = parseWorkbook(readFileSync('zadani/DZ_case_study_rebalancing_data.xlsx'));
const w = (name: string, key: string) => valuate(data, name, S).assets.find((a) => a.key === key)!;
const trades = (name: string) => recommend(data, name, S).plan.stages.flatMap((s) => s.trades);

describe('načtení dat', () => {
  it('načte zadání bez varování', () => {
    expect(warnings).toEqual([]);
    expect(data.asOf).toBe('2026-10-23');
    expect(data.clients).toHaveLength(5);
    expect(data.lots).toHaveLength(24);
  });
});

describe('ocenění a odchylky', () => {
  it('Klient A: 1500+600 ks VWCE × 142,5 EUR × 24,3 = 7 271 775 Kč', () => {
    expect(w('Klient A', 'VWCE').valueCzk).toBeCloseTo(2100 * 142.5 * 24.3, 2);
    expect(valuate(data, 'Klient A', S).totalCzk).toBeCloseTo(10_267_798.2, 0);
    expect(w('Klient A', 'VWCE').drift * 100).toBeCloseTo(10.82, 1);
    expect(w('Klient A', 'EUNA').drift * 100).toBeCloseTo(-10.49, 1);
  });
  it('hotovost v cizí měně se přepočítá kurzem', () => {
    expect(w('Klient E', CASH).valueCzk).toBeCloseTo(35_000 + 820 * 21, 2);
  });
  it('celkový majetek ostatních klientů', () => {
    expect(valuate(data, 'Klient B', S).totalCzk).toBeCloseTo(19_859_317, -1);
    expect(valuate(data, 'Klient C', S).totalCzk).toBeCloseTo(6_035_922, -1);
    expect(valuate(data, 'Klient D', S).totalCzk).toBeCloseTo(10_560_541.5, 0);
    expect(valuate(data, 'Klient E', S).totalCzk).toBeCloseTo(22_100_414, -1);
  });
});

describe('toleranční pásmo 5/25', () => {
  it('velká váha → 5 p. b., malá váha → 25 % cíle', () => {
    expect(tolerance('VWCE', 0.6, S)).toBeCloseTo(0.05);
    expect(tolerance('IGLN', 0.1, S)).toBeCloseTo(0.025);
    expect(tolerance(CASH, 0.05, S)).toBeCloseTo(0.01);
  });
});

describe('daně', () => {
  it('časový test: osvobozeno až den po 3. výročí', () => {
    expect(exemptFrom('2023-11-20', 'FO', S)).toBe('2026-11-21');
    expect(exemptFrom('2023-11-20', 'PO', S)).toBeNull();
  });
  it('FO: 15 % ze zdanitelného zisku, ztráta se započte, osvobozená ztráta ne', () => {
    const r = taxOnSales(
      [
        { proceedsCzk: 500_000, gainCzk: 100_000, exempt: false },
        { proceedsCzk: 200_000, gainCzk: -20_000, exempt: false },
        { proceedsCzk: 300_000, gainCzk: -50_000, exempt: true },
        { proceedsCzk: 300_000, gainCzk: 90_000, exempt: true },
      ],
      'FO',
      S,
    );
    expect(r.taxableGainCzk).toBe(80_000);
    expect(r.taxCzk).toBeCloseTo(12_000);
  });
  it('FO: prodeje do 100 000 Kč jsou osvobozené', () => {
    expect(taxOnSales([{ proceedsCzk: 90_000, gainCzk: 30_000, exempt: false }], 'FO', S).taxCzk).toBe(0);
  });
  it('PO: 21 % vždy', () => {
    expect(taxOnSales([{ proceedsCzk: 90_000, gainCzk: 30_000, exempt: false }], 'PO', S).taxCzk).toBeCloseTo(6_300);
  });
});

describe('doporučení pro přiložená data', () => {
  it('Klient C: v pásmu → žádný obchod', () => {
    const r = recommend(data, 'Klient C', S);
    expect(r.plan.status).toBe('none');
    expect(r.plan.stages).toHaveLength(0);
    expect(r.plan.costCzk).toBe(0);
  });

  it('Klient A: vklad nestačí, prodává se osvobozený nákup z roku 2021 → daň 0', () => {
    const r = recommend(data, 'Klient A', S);
    expect(r.plan.status).toBe('rebalance');
    const sells = trades('Klient A').filter((t) => t.side === 'sell');
    expect(sells.map((t) => t.ticker)).toEqual(['VWCE']);
    // cíl 60 % z (10 267 798 + 600 000) = 6 520 679 → prodat 751 096 Kč
    expect(sells[0].czk).toBeCloseTo(7_271_775 - 0.6 * 10_867_798.2, -2);
    expect(sells[0].lots.every((l) => l.buyDate === '2021-03-15' && l.exempt)).toBe(true);
    expect(r.plan.taxCzk).toBe(0);
    expect(r.plan.after.every((a) => !a.breached)).toBe(true);
    // nákupy z vkladu až po jeho připsání
    expect(r.plan.stages.map((s) => s.date)).toEqual(['2026-10-23', '2026-11-10']);
  });

  it('Klient B: výběry pokryty prodejem nadvážených aktiv z osvobozených nákupů', () => {
    const r = recommend(data, 'Klient B', S);
    expect(r.plan.status).toBe('cashflow');
    expect(r.plan.netFlowCzk).toBe(-1_755_000); // 3 renty + jednorázový výběr do 90 dnů
    expect(r.plan.buyCzk).toBe(0);
    expect(r.plan.taxCzk).toBe(0);
    expect(r.plan.cashShortfall).toBe(false);
    // hotovost po výběrech = cílových 5 %
    expect(r.plan.after.find((a) => a.key === CASH)!.weight).toBeCloseTo(0.05, 3);
  });

  it('Klient D (s.r.o.): jen nákupy z hotovosti, žádný prodej, žádná daň', () => {
    const r = recommend(data, 'Klient D', S);
    const t = trades('Klient D');
    expect(t.every((x) => x.side === 'buy')).toBe(true);
    expect(r.plan.buyCzk).toBeCloseTo(4_500_000, -1);
    expect(r.plan.taxCzk).toBe(0);
    expect(r.plan.flowsLater).toHaveLength(1); // únorový vklad je za horizontem
    expect(r.plan.after.find((a) => a.key === 'VWCE')!.weight).toBeCloseTo(0.55, 3);
  });

  it('Klient E: počkat na 21. 11. 2026, kdy se osvobodí nákup z 20. 11. 2023', () => {
    const r = recommend(data, 'Klient E', S);
    expect(r.plan.status).toBe('wait');
    expect(r.plan.deferredUntil).toBe('2026-11-21');
    expect(r.plan.taxCzk).toBe(0);
    // okamžitý prodej: 623 295 Kč z osvobozeného nákupu 2020, zbytek zdanitelný
    // nákup 2025 (260 ks, zisk 156 055) + část nákupu 2023 (zisk 30,74 % z prodané částky)
    const sellNow = 12_604_410 - 0.45 * (22_100_414 - 250_000);
    const from2023 = sellNow - 623_295 - 900_315;
    const expectedTax = 0.15 * (156_055.14 + from2023 * ((142.5 - 98.7) / 142.5));
    expect(r.nowPlan.taxCzk).toBeCloseTo(expectedTax, -2);
    expect(r.taxSavedByWaitingCzk).toBeGreaterThan(70_000);
    expect(r.plan.cashShortfall).toBe(false);
  });

  it('nákupy nikdy nepřesáhnou dostupnou hotovost', () => {
    for (const c of data.clients) {
      const p = recommend(data, c.name, S).plan;
      expect(p.after.find((a) => a.key === CASH)!.valueCzk).toBeGreaterThan(-1);
    }
  });
});
