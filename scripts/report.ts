// Vygeneruje docs/VYSTUP.md – výstup pro přiložená data. Spuštění: npm run report
// Používá stejné jádro jako webová aplikace, takže čísla jsou vždy shodná.

import { readFileSync, writeFileSync } from 'node:fs';
import { czk, day, doneDate, explain, label, money, pct, pp, qty, signed, STATUS_LABEL, statusKind, tradeCount, variantTitle } from '../adapters/cs';
import { parseWorkbook } from '../adapters/excel';
import { DEFAULT_SETTINGS as S, recommend, shockEffect, type Plan } from '../engine';

const { dataset } = parseWorkbook(readFileSync('zadani/DZ_case_study_rebalancing_data.xlsx'));
const L: string[] = [];
const recs = dataset.clients.map((c) => recommend(dataset, c.name, S));

L.push('# Výstup pro přiložená data', '');
L.push(`Ocenění k ${day(dataset.asOf)}. Výchozí pravidla (viz POPIS.md). Soubor generuje \`npm run report\` ze stejného jádra, které používá aplikace.`, '');
L.push('| Klient | Majetek | Největší odchylka | Doporučení | Obrat | Poplatky | Daň |', '|---|---:|---|---|---:|---:|---:|');
for (const r of recs) {
  const p = r.plan;
  const w = p.valuation.worst;
  L.push(`| ${p.clientName} | ${czk(p.valuation.totalCzk)} | ${label(w.key)} ${pp(w.drift)} | **${STATUS_LABEL[statusKind(p)]}** | ${czk(p.turnoverCzk)} | ${czk(p.feesCzk)} | ${czk(p.taxCzk)} |`);
}
L.push('');

for (const r of recs) {
  const p = r.plan;
  const c = p.valuation.client;
  L.push(`## ${c.name}: ${STATUS_LABEL[statusKind(p)]}`, '');
  L.push(`${c.profile} · ${c.taxRegime === 'FO' ? 'fyzická osoba' : 's.r.o.'} · ${c.note}`, '');
  L.push('**Proč:**', '');
  for (const line of explain(r, S)) L.push(`- ${line}`);
  L.push('', '| Aktivum | Hodnota | Váha | Cíl | Odchylka | Pásmo | Po zásahu |', '|---|---:|---:|---:|---:|---:|---:|');
  p.valuation.assets.forEach((a, i) =>
    L.push(`| ${label(a.key)} | ${czk(a.valueCzk)} | ${pct(a.weight)} | ${pct(a.target)} | ${pp(a.drift)}${a.breached ? ' ⚠' : ''} | ±${pp(a.tolerance).replace('+', '')} | ${pct(p.after[i].weight)} |`),
  );
  L.push('');
  if (p.stages.length === 0) L.push('Žádné obchody.', '');
  else {
    L.push('| Kdy | Akce | Ticker | Kusy | Částka | V měně | Z nákupů |', '|---|---|---|---:|---:|---:|---|');
    for (const st of p.stages)
      for (const t of st.trades)
        L.push(
          `| ${st.isNow ? 'hned' : day(st.date)} | ${t.side === 'buy' ? 'Nákup' : 'Prodej'} | ${t.ticker} | ${qty(t.qty)} | ${czk(t.czk)} | ${money(t.amountLocal, t.currency)} | ${t.lots.map((l) => `${day(l.buyDate)}: ${qty(l.qty)} ks, ${l.exempt ? 'osvobozeno' : 'zdanitelné'}`).join('; ')} |`,
        );
    L.push('', `Obrat ${czk(p.turnoverCzk)} · poplatky ${czk(p.feesCzk)} · daň ${czk(p.taxCzk)} · náklady celkem ${czk(p.costCzk)} (${pct(p.costCzk / p.projectedTotalCzk)} majetku).`, '');

    const variants = [r.nowPlan, r.waitPlan, r.stagedPlan].filter((x): x is Plan => x !== null);
    if (variants.length > 1) {
      L.push(`**Varianty provedení** (scénář: trh se po první části posune o ${S.shockPct} %, rozdíl proti „všechno hned“):`, '');
      L.push(`| Varianta | Hotovo | Obchodních dnů | Pokynů | Poplatky | Daň | Trh −${S.shockPct} % | Trh +${S.shockPct} % |`, '|---|---|---:|---:|---:|---:|---:|---:|');
      for (const v of variants) {
        const e = shockEffect(v, r.nowPlan, S.shockPct);
        L.push(
          `| ${variantTitle(v)}${v === p ? ' **(doporučeno)**' : ''} | ${day(doneDate(v)!)} | ${v.stages.length} | ${tradeCount(v)} | ${czk(v.feesCzk)} | ${czk(v.taxCzk)} | ${signed(e.downCzk)} | ${signed(e.upCzk)} |`,
        );
      }
      L.push('');
    }
  }
}

writeFileSync('docs/VYSTUP.md', L.join('\n'));
console.log('docs/VYSTUP.md zapsán.');
