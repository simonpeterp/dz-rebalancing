// Export navržených pokynů do CSV (středník + BOM, aby ho český Excel otevřel správně).

import type { Dataset, Plan } from '../engine';

const n = (x: number, d = 2) => x.toFixed(d).replace('.', ',');

export function ordersCsv(data: Dataset, plans: Plan[]): string {
  const rows = [['Klient', 'Datum', 'Akce', 'Ticker', 'ISIN', 'Kusy', 'Měna', 'Částka v měně', 'Částka CZK', 'Poplatek CZK', 'Z nákupů']];
  for (const p of plans)
    for (const st of p.stages)
      for (const t of st.trades)
        rows.push([
          p.clientName,
          st.date,
          t.side === 'buy' ? 'NÁKUP' : 'PRODEJ',
          t.ticker,
          data.instruments.find((i) => i.ticker === t.ticker)?.isin ?? '',
          n(t.qty, 4),
          t.currency,
          n(t.amountLocal),
          n(t.czk),
          n(t.feeCzk),
          t.lots.map((l) => `${l.buyDate}: ${n(l.qty, 4)} ks${l.exempt ? ' (osvobozeno)' : ''}`).join(' | '),
        ]);
  return '﻿' + rows.map((r) => r.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';')).join('\r\n');
}
