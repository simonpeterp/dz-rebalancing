// Načtení dat z Excelu ve formátu zadání (listy Instrumenty, Kurzy, Klienti, Pozice, Hotovost, Cash flow).

import * as XLSX from 'xlsx';
import { CASH, toISO, type Dataset, type TaxRegime } from '../engine';

type Row = unknown[];

const str = (v: unknown) => (v == null ? '' : String(v).trim());
const num = (v: unknown, what: string): number => {
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) throw new Error(`${what}: „${str(v)}“ není číslo.`);
  return n;
};

/** Excel ukládá datum jako pořadové číslo dne; přijmeme i text „23. 10. 2026“ nebo ISO. */
function date(v: unknown, what: string): string {
  if (typeof v === 'number') return toISO(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000));
  if (v instanceof Date) return toISO(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())));
  const s = str(v);
  const cz = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (cz) return `${cz[3]}-${cz[2].padStart(2, '0')}-${cz[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  throw new Error(`${what}: „${s}“ není datum.`);
}

export interface LoadResult {
  dataset: Dataset;
  warnings: string[];
}

export function parseWorkbook(bytes: ArrayBuffer | Uint8Array): LoadResult {
  const wb = XLSX.read(bytes, { type: 'array' });
  const warnings: string[] = [];
  const rows = (name: string): Row[] => {
    const ws = wb.Sheets[name];
    if (!ws) throw new Error(`V souboru chybí list „${name}“.`);
    return (XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as Row[]).filter((r) => r.some((c) => c != null && c !== ''));
  };
  const body = (name: string) => rows(name).slice(1);

  // Datum ocenění je v listu „Čti mě“; když chybí, použije se dnešek.
  let asOf = toISO(new Date());
  const readme = wb.Sheets['Čti mě'] ? rows('Čti mě').flat().map(str).join('\n') : '';
  const m = readme.match(/Ocenění k datu:\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (m) asOf = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  else warnings.push('Datum ocenění nenalezeno (list „Čti mě“, řádek „Ocenění k datu: …“) – použito dnešní datum.');

  const instruments = body('Instrumenty').map((r) => ({
    ticker: str(r[0]),
    name: str(r[1]),
    isin: str(r[2]),
    currency: str(r[3]),
    assetClass: str(r[4]),
    price: num(r[5], `Cena ${str(r[0])}`),
  }));
  const tickers = new Set(instruments.map((i) => i.ticker));

  const fx: Record<string, number> = { CZK: 1 };
  for (const r of body('Kurzy')) fx[str(r[0]).split('/')[0]] = num(r[1], `Kurz ${str(r[0])}`);
  for (const i of instruments) if (!fx[i.currency]) throw new Error(`Chybí kurz pro měnu ${i.currency} (instrument ${i.ticker}).`);

  const kl = rows('Klienti');
  const head = kl[0].map(str);
  const targetCols = head
    .map((h, idx) => ({ idx, m: h.match(/^Cíl (.+?) %$/) }))
    .filter((x) => x.m)
    .map((x) => ({ idx: x.idx, key: /hotovost/i.test(x.m![1]) ? CASH : x.m![1] }));
  const noteIdx = head.findIndex((h) => /poznámka/i.test(h));
  const clients = kl.slice(1).map((r) => {
    const name = str(r[0]);
    const targets: Record<string, number> = {};
    for (const c of targetCols) {
      if (c.key !== CASH && !tickers.has(c.key)) throw new Error(`Klienti: cíl pro neznámý instrument ${c.key}.`);
      targets[c.key] = num(r[c.idx] ?? 0, `Cíl ${c.key} (${name})`) / 100;
    }
    const total = Object.values(targets).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 1) > 1e-6) warnings.push(`${name}: cílové váhy dávají ${(total * 100).toFixed(1)} %, ne 100 %.`);
    const regime: TaxRegime = /s\.?\s*r\.?\s*o|PO|a\.?\s*s/i.test(str(r[2])) ? 'PO' : 'FO';
    return { name, profile: str(r[1]), taxRegime: regime, targets, note: noteIdx >= 0 ? str(r[noteIdx]) : '' };
  });
  const names = new Set(clients.map((c) => c.name));
  const known = (name: string, sheet: string) => {
    if (!names.has(name)) throw new Error(`${sheet}: klient „${name}“ není v listu Klienti.`);
    return name;
  };

  const lots = body('Pozice').map((r) => {
    const ticker = str(r[1]);
    if (!tickers.has(ticker)) throw new Error(`Pozice: neznámý instrument ${ticker}.`);
    return {
      client: known(str(r[0]), 'Pozice'),
      ticker,
      buyDate: date(r[2], 'Pozice, datum nákupu'),
      qty: num(r[3], 'Pozice, počet kusů'),
      buyPrice: num(r[4], 'Pozice, nákupní cena'),
    };
  });

  const cash = body('Hotovost').map((r) => {
    const currency = str(r[1]);
    if (!fx[currency]) throw new Error(`Hotovost: chybí kurz pro měnu ${currency}.`);
    return { client: known(str(r[0]), 'Hotovost'), currency, amount: num(r[2], 'Hotovost, zůstatek') };
  });

  const cashFlows = body('Cash flow').map((r) => ({
    client: known(str(r[0]), 'Cash flow'),
    date: date(r[1], 'Cash flow, datum'),
    amountCzk: num(r[3], 'Cash flow, částka'),
    note: str(r[4]),
  }));

  return { dataset: { asOf, instruments, fx, clients, lots, cash, cashFlows }, warnings };
}
