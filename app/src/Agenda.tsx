// Kalendář akcí: všechno, co se má stát, seřazené podle data. Používá ho přehled
// (všichni klienti pohromadě) i detail klienta.

import { useState } from 'react';
import { czk, day, signed, tradesText } from '../../adapters/cs';
import { diffDays, type AgendaEvent, type ChangeKind } from '../../engine';
import type { TLItem } from './charts';
import { ChangeTag } from './ui';

export interface AgendaRow {
  ev: AgendaEvent;
  change: ChangeKind;
}

const idOf = (e: AgendaEvent) => `${e.clientName}|${e.date}|${e.kind}|${e.kind === 'exempt' ? e.ticker + e.buyDate : e.kind === 'flow' ? e.note + e.amountCzk : ''}`;
const sigOf = (e: AgendaEvent) => (e.kind === 'trade' ? e.trades.map((t) => `${t.side}${t.ticker}${Math.round(t.czk)}`).join() : '');

/** Označí události, které proti výchozímu stavu přibyly, zmizely nebo se změnily. */
export function agendaWithChanges(current: AgendaEvent[], base: AgendaEvent[]): AgendaRow[] {
  const before = new Map(base.map((e) => [idOf(e), e]));
  const now = new Set(current.map(idOf));
  const rows: AgendaRow[] = current.map((ev) => {
    const old = before.get(idOf(ev));
    return { ev, change: !old ? 'added' : sigOf(old) !== sigOf(ev) ? 'changed' : 'same' };
  });
  for (const e of base) if (!now.has(idOf(e))) rows.push({ ev: e, change: 'removed' });
  return rows.sort((a, b) => a.ev.date.localeCompare(b.ev.date));
}

export function eventText(e: AgendaEvent): { tag: string; cls: string; text: string; amount: string } {
  if (e.kind === 'trade') {
    const extra = [e.part ? `${e.part}. část z ${e.parts}` : '', e.afterTimeTest ? 'po splnění časového testu' : ''].filter(Boolean).join(', ');
    return { tag: 'Obchod', cls: 'ev-trade', text: tradesText(e.trades) + (extra ? ` (${extra})` : ''), amount: `obrat ${czk(e.sellCzk + e.buyCzk)}` };
  }
  if (e.kind === 'flow')
    return {
      tag: e.amountCzk > 0 ? 'Vklad' : 'Výběr',
      cls: e.amountCzk > 0 ? 'ev-in' : 'ev-out',
      text: (e.note || (e.amountCzk > 0 ? 'Vklad' : 'Výběr')) + (e.inHorizon ? '' : ' (za horizontem, zatím se s ním neobchoduje)'),
      amount: signed(e.amountCzk),
    };
  return { tag: 'Osvobození', cls: 'ev-exempt', text: `${e.ticker} z nákupu ${day(e.buyDate)} splní časový test`, amount: `odpadne daň ${czk(e.taxSavedCzk)}` };
}

export function timelineItem(e: AgendaEvent): TLItem {
  const t = eventText(e);
  return { date: e.date, kind: e.kind === 'flow' ? (e.amountCzk > 0 ? 'in' : 'out') : e.kind, title: `${e.clientName}: ${t.tag.toLowerCase()}`, detail: e.kind === 'trade' ? t.text : `${t.text} · ${t.amount}` };
}

type Filter = 'all' | AgendaEvent['kind'];
const FILTERS: [Filter, string][] = [
  ['all', 'Vše'],
  ['trade', 'Obchody'],
  ['flow', 'Vklady a výběry'],
  ['exempt', 'Daňová osvobození'],
];

/** `foldAfter`: události po tomto datu (typicky za horizontem) se ukážou až na vyžádání. */
export function Agenda({ asOf, rows, showClient, foldAfter }: { asOf: string; rows: AgendaRow[]; showClient: boolean; foldAfter?: string }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [all, setAll] = useState(false);
  const matching = rows.filter((r) => filter === 'all' || r.ev.kind === filter);
  const shown = foldAfter && !all ? matching.filter((r) => r.ev.date <= foldAfter) : matching;
  const hidden = matching.length - shown.length;
  const count = (f: Filter) => rows.filter((r) => r.change !== 'removed' && (f === 'all' || r.ev.kind === f)).length;
  const when = (d: string) => {
    const n = diffDays(asOf, d);
    return n === 0 ? 'dnes' : n === 1 ? 'zítra' : `za ${n} dnů`;
  };
  return (
    <>
      <div className="filters" role="group" aria-label="Druh události">
        {FILTERS.filter(([f]) => count(f) > 0).map(([f, name]) => (
          <button key={f} className={`pill ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)} aria-pressed={filter === f}>
            {name} {count(f)}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="muted">{hidden > 0 ? `Do ${day(foldAfter!)} nic.` : 'V příštích 12 měsících se nic neděje.'}</p>
      ) : (
        <div className="scroll">
          <table className="tbl tbl-agenda">
            <thead>
              <tr>
                <th>Kdy</th>
                {showClient && <th>Klient</th>}
                <th>Co</th>
                <th>Podrobnosti</th>
                <th className="num">Částka</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ ev, change }, i) => {
                const t = eventText(ev);
                const first = i === 0 || shown[i - 1].ev.date !== ev.date;
                const href = `#/klient/${encodeURIComponent(ev.clientName)}`;
                return (
                  <tr key={i} className={`${first ? 'agenda-first' : ''} ${change === 'removed' ? 'row-removed' : ''} ${change === 'added' || change === 'changed' ? 'row-changed' : ''}`}>
                    <td className="agenda-date">
                      {first && (
                        <>
                          <strong>{day(ev.date)}</strong>
                          <span className="sub">{when(ev.date)}</span>
                        </>
                      )}
                    </td>
                    {showClient && (
                      <td>
                        <a href={href} className="client-name">
                          {ev.clientName}
                        </a>
                      </td>
                    )}
                    <td>
                      <span className={`ev ${t.cls}`}>{t.tag}</span>
                    </td>
                    <td className="agenda-text">
                      {t.text} <ChangeTag kind={change} />
                    </td>
                    <td className="num">{t.amount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {foldAfter && (hidden > 0 || all) && (
        <button className="btn agenda-more" onClick={() => setAll((x) => !x)}>
          {all ? `Jen do konce horizontu (${day(foldAfter)})` : `Zobrazit i ${hidden} vzdálenějších, po ${day(foldAfter)}`}
        </button>
      )}
    </>
  );
}
