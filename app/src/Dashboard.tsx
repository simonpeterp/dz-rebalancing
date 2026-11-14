import { useMemo, useState } from 'react';
import { STATUS_LABEL, STATUS_ORDER, czk, day, label, mil, pp, statusKind, summary, type StatusKind } from '../../adapters/cs';
import { ordersCsv } from '../../adapters/csv';
import { exemptionCalendar, type Dataset, type Settings } from '../../engine';
import type { Row } from './App';
import { DriftBar, Kpi, StatusChip, download } from './ui';

export function Dashboard({ data, rows, settings: s }: { data: Dataset; rows: Row[]; settings: Settings }) {
  const [filter, setFilter] = useState<StatusKind | 'all'>('all');
  const [q, setQ] = useState('');

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const ka = statusKind(a.plan);
        const kb = statusKind(b.plan);
        const wa = a.plan.valuation.worst;
        const wb = b.plan.valuation.worst;
        return STATUS_ORDER[ka] - STATUS_ORDER[kb] || Math.abs(wb.drift) / wb.tolerance - Math.abs(wa.drift) / wa.tolerance;
      }),
    [rows],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[statusKind(r.plan)] = (c[statusKind(r.plan)] ?? 0) + 1;
    return c;
  }, [rows]);
  const shown = sorted.filter(
    (r) => (filter === 'all' || statusKind(r.plan) === filter) && r.plan.clientName.toLowerCase().includes(q.trim().toLowerCase()),
  );

  const aum = rows.reduce((a, r) => a + r.plan.valuation.totalCzk, 0);
  const acting = rows.filter((r) => r.plan.status !== 'none');
  const turnover = rows.reduce((a, r) => a + r.plan.turnoverCzk, 0);
  const fees = rows.reduce((a, r) => a + r.plan.feesCzk, 0);
  const tax = rows.reduce((a, r) => a + r.plan.taxCzk, 0);
  const saved = rows.reduce((a, r) => a + (r.plan === r.rec.waitPlan ? r.rec.taxSavedByWaitingCzk : 0), 0);

  const calendar = useMemo(() => exemptionCalendar(data, s, 365), [data, s]);
  const flows = data.cashFlows.filter((f) => f.date > data.asOf).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <div className="page-head">
        <h1>Přehled portfolií</h1>
        <button className="btn" onClick={() => download(`pokyny-${data.asOf}.csv`, ordersCsv(data, rows.map((r) => r.plan)))} disabled={acting.length === 0}>
          Stáhnout všechny pokyny (CSV)
        </button>
      </div>

      <section className="kpis">
        <Kpi label="Spravovaný majetek" value={mil(aum)} hint={`${rows.length} klientů`} />
        <Kpi label="Potřebuje zásah" value={`${acting.length} z ${rows.length}`} hint={`${rows.length - acting.length} v pásmu`} />
        <Kpi label="Objem navržených obchodů" value={mil(turnover)} hint={`${((turnover / aum) * 100).toFixed(1).replace('.', ',')} % majetku`} />
        <Kpi label="Náklady zásahů" value={czk(fees + tax)} hint={`poplatky ${czk(fees)} · daň ${czk(tax)}`} />
        <Kpi label="Ušetřeno čekáním" value={czk(saved)} hint="daň, která odpadne po časovém testu" />
      </section>

      <section className="card">
        <div className="toolbar">
          <div className="filters" role="group" aria-label="Filtr podle stavu">
            <button className={`pill ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
              Všichni {rows.length}
            </button>
            {(Object.keys(STATUS_ORDER) as StatusKind[])
              .filter((k) => counts[k])
              .map((k) => (
                <button key={k} className={`pill ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>
                  {STATUS_LABEL[k]} {counts[k]}
                </button>
              ))}
          </div>
          <input className="search" type="search" placeholder="Hledat klienta" aria-label="Hledat klienta" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="scroll">
          <table className="tbl tbl-clients">
            <thead>
              <tr>
                <th>Klient</th>
                <th className="num">Majetek</th>
                <th>Největší odchylka</th>
                <th>Stav</th>
                <th>Co udělat</th>
                <th className="num">Náklady</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ plan: p }) => {
                const w = p.valuation.worst;
                const c = p.valuation.client;
                const href = `#/klient/${encodeURIComponent(c.name)}`;
                return (
                  <tr key={c.name} className="row-link" onClick={() => (window.location.hash = href)}>
                    <td>
                      <a href={href} className="client-name" onClick={(e) => e.stopPropagation()}>
                        {c.name}
                      </a>
                      <div className="sub">
                        {c.taxRegime === 'FO' ? 'FO' : 's.r.o.'} · {c.profile}
                      </div>
                    </td>
                    <td className="num">{czk(p.valuation.totalCzk)}</td>
                    <td>
                      <div className="drift-cell">
                        <DriftBar drift={w.drift} tolerance={w.tolerance} />
                        <span className={w.breached ? 'bad' : ''}>
                          {label(w.key)} {pp(w.drift)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusChip kind={statusKind(p)} />
                    </td>
                    <td className="what">{summary(p)}</td>
                    <td className="num">{p.costCzk > 0 ? czk(p.costCzk) : '–'}</td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Žádný klient neodpovídá filtru.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="two">
        <section className="card">
          <h2>Daňový kalendář</h2>
          <p className="muted">Pozice fyzických osob, které během 12 měsíců splní časový test. Do té doby je lepší je neprodávat.</p>
          {calendar.length === 0 ? (
            <p className="muted">V příštích 12 měsících se žádná pozice neosvobodí.</p>
          ) : (
            <table className="tbl tbl-tight">
              <thead>
                <tr>
                  <th>Osvobozeno od</th>
                  <th>Klient</th>
                  <th>Pozice</th>
                  <th className="num">Daň, která odpadne</th>
                </tr>
              </thead>
              <tbody>
                {calendar.map((e) => (
                  <tr key={e.clientName + e.ticker + e.buyDate}>
                    <td>
                      {day(e.exemptFrom)} <span className="sub-inline">za {e.days} dnů</span>
                    </td>
                    <td>{e.clientName}</td>
                    <td>
                      {e.ticker} <span className="sub-inline">nákup {day(e.buyDate)}</span>
                    </td>
                    <td className="num">{czk(e.taxSavedCzk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2>Plánované vklady a výběry</h2>
          <p className="muted">
            Do návrhu se počítají pohyby v příštích {s.horizonDays} dnech. Vzdálenější jsou vidět, ale zatím se s nimi neobchoduje.
          </p>
          {flows.length === 0 ? (
            <p className="muted">Žádné plánované pohyby.</p>
          ) : (
            <table className="tbl tbl-tight">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Klient</th>
                  <th>Poznámka</th>
                  <th className="num">Částka</th>
                </tr>
              </thead>
              <tbody>
                {flows.map((f, i) => (
                  <tr key={i} className={f.date > rows[0]?.plan.horizonEnd ? 'dim' : ''}>
                    <td>{day(f.date)}</td>
                    <td>{f.client}</td>
                    <td>{f.note}</td>
                    <td className={`num ${f.amountCzk > 0 ? 'pos' : ''}`}>{(f.amountCzk > 0 ? '+' : '−') + czk(Math.abs(f.amountCzk))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="card rules">
        <h2>Podle čeho nástroj rozhoduje</h2>
        <ol>
          <li>
            <strong>Toleranční pásmo.</strong> Zásah až když se aktivum odchýlí o víc než {s.absBandPp} p. b., nebo o víc než {s.relBandPct} % své
            cílové váhy (platí užší z obou). Hotovost má pásmo ±{s.cashBandPp} p. b.
          </li>
          <li>
            <strong>Cash flow nejdřív.</strong> Vklady jdou do podvážených aktiv, na výběry se prodávají nadvážená. Teprve potom se kontroluje pásmo.
          </li>
          <li>
            <strong>Mimo pásmo se dorovnává na cíl.</strong> Obchody menší než {String(s.minTradePct).replace('.', ',')} % portfolia se vynechávají.
          </li>
          <li>
            <strong>Daňově nejlevnější kusy napřed.</strong> Ztrátové, potom osvobozené ({s.timeTestYears} roky u fyzických osob), zdanitelné až
            nakonec od nejmenšího zisku.
          </li>
          <li>
            <strong>Počkat, když se to vyplatí.</strong> Pokud se pozice osvobodí do {s.waitMaxDays} dnů a ušetří to aspoň {czk(s.waitMinSavingCzk)},
            prodej se odloží.
          </li>
        </ol>
      </section>
    </>
  );
}
