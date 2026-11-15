// Popis nastavitelných pravidel: jedno místo pro panel pravidel i pro výpis změn.

import type { Settings } from '../../engine';

export type NumKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];

export interface Field {
  key: NumKey;
  name: string;
  unit: string;
  step: number;
}

export const GROUPS: { title: string; hint: string; fields: Field[] }[] = [
  {
    title: 'Toleranční pásma',
    hint: 'Zasahuje se až za hranicí pásma. Platí užší z absolutní a relativní hranice.',
    fields: [
      { key: 'absBandPp', name: 'Absolutní pásmo', unit: 'p. b.', step: 0.5 },
      { key: 'relBandPct', name: 'Relativní pásmo', unit: '% cíle', step: 5 },
      { key: 'cashBandPp', name: 'Pásmo hotovosti', unit: 'p. b.', step: 0.5 },
      { key: 'minTradePct', name: 'Nejmenší obchod', unit: '% portfolia', step: 0.1 },
    ],
  },
  {
    title: 'Vklady a výběry',
    hint: 'Pohyby v horizontu se započtou předem: vklad jde do podvážených aktiv, na výběr se prodávají nadvážená.',
    fields: [{ key: 'horizonDays', name: 'Horizont', unit: 'dnů dopředu', step: 30 }],
  },
  {
    title: 'Poplatky brokera',
    hint: 'Účtují se za každý pokyn.',
    fields: [
      { key: 'feePct', name: 'Poplatek z objemu', unit: '%', step: 0.05 },
      { key: 'feeMinCzk', name: 'Nejméně za pokyn', unit: 'Kč', step: 10 },
    ],
  },
  {
    title: 'Daně (ČR)',
    hint: 'Fyzická osoba je po časovém testu osvobozená, právnická daní vždy.',
    fields: [
      { key: 'taxRateFO', name: 'Fyzická osoba', unit: '%', step: 1 },
      { key: 'taxRatePO', name: 'Právnická osoba', unit: '%', step: 1 },
      { key: 'timeTestYears', name: 'Časový test', unit: 'roky', step: 1 },
      { key: 'smallSalesLimitCzk', name: 'Osvobozené prodeje do', unit: 'Kč za rok', step: 10000 },
    ],
  },
  {
    title: 'Čekání na osvobození',
    hint: 'Prodej se odloží, když se nákup brzy osvobodí a úspora na dani za to stojí.',
    fields: [
      { key: 'waitMaxDays', name: 'Čekat nejvýše', unit: 'dnů', step: 30 },
      { key: 'waitMinSavingCzk', name: 'Když ušetří aspoň', unit: 'Kč', step: 1000 },
    ],
  },
  {
    title: 'Rozložení v čase',
    hint: 'Velký nákup z hotovosti se rozdělí na části. Scénář ukazuje, co udělá pohyb trhu mezi nimi.',
    fields: [
      { key: 'stageParts', name: 'Počet částí', unit: '1 = nerozkládat', step: 1 },
      { key: 'stageIntervalDays', name: 'Odstup částí', unit: 'dnů', step: 5 },
      { key: 'stageMinPct', name: 'Doporučit od nákupu', unit: '% portfolia', step: 5 },
      { key: 'shockPct', name: 'Scénář: pohyb trhu ±', unit: '%', step: 5 },
    ],
  },
];

const num = (x: number) => String(x).replace('.', ',');

/** Která pravidla se liší, jako krátké věty: „Poplatek z objemu: 0,1 → 0,2 %“. */
export function settingsChanges(before: Settings, after: Settings): string[] {
  const out: string[] = [];
  for (const g of GROUPS)
    for (const f of g.fields)
      if (before[f.key] !== after[f.key]) out.push(`${f.name}: ${num(before[f.key])} → ${num(after[f.key])} ${f.unit === '1 = nerozkládat' ? '' : f.unit}`.trim());
  if (before.wholeUnits !== after.wholeUnits) out.push(after.wholeUnits ? 'Jen celé kusy' : 'Povoleny zlomky kusů');
  return out;
}
