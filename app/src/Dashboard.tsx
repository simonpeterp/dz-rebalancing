import { useMemo, useState } from 'react';
import { STATUS_LABEL, STATUS_ORDER, czk, day, label, mil, pct, pp, statusKind, summary, tradeCount, type StatusKind } from '../../adapters/cs';
import { ordersCsv } from '../../adapters/csv';
import { CASH, addDays, agenda, offTargetCzk, type Dataset, type Plan, type Settings } from '../../engine';
import { Agenda, agendaWithChanges, timelineItem } from './Agenda';
import type { Row } from './App';
import { CompareAll } from './Changes';
import { Allocation, Timeline, TimelineLegend, type Series, type TLKind } from './charts';
import { ChangeTag, Delta, DriftBar, Kpi, StatusChip, assetColor, download } from './ui';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Souhrnná čísla za všechny klienty pro jednu sadu plánů (současnou nebo výchozí). */
function totals(plans: Plan[]) {
  const aum = sum(plans.map((p) => p.valuation.totalCzk));
  const off = sum(plans.map((p) => offTargetCzk(p.valuation.assets, p.valuation.totalCzk)));
  const offAfter = sum(plans.map((p) => offTargetCzk(p.after, p.projectedTotalCzk)));
  const dates = new Set(plans.flatMap((p) => p.stages.map((s) => s.date)));
  return {
    aum,
    off,
    offAfter,
    acting: plans.filter((p) => p.status !== 'none').length,
    orders: sum(plans.map(tradeCount)),
    days: dates.size,
    lastDay: [...dates].sort().pop() ?? null,
    turnover: sum(plans.map((p) => p.turnoverCzk)),
    fees: sum(plans.map((p) => p.feesCzk)),
    tax: sum(plans.map((p) => p.taxCzk)),
  };
}

export function Dashboard({ data, rows, settings: s, compare }: { data: Dataset; rows: Row[]; settings: Settings; compare: boolean }) {
  const [filter, setFilter] = useState<StatusKind | 'all'>('all');
  const [q, setQ] = useState('');
  const plans = useMemo(() => rows.map((r) => r.plan), [rows]);
  const basePlans = useMemo(() => rows.map((r) => r.base), [rows]);
  const t = useMemo(() => totals(plans), [plans]);
  const b = useMemo(() => totals(basePlans), [basePlans]);
  const saved = sum(rows.map((r) => (r.plan.deferredUntil ? r.rec.taxSavedByWaitingCzk : 0)));

  const sorted = useMemo(
    () =>
      [...rows].sort((x, y) => {
        const wa = x.plan.valuation.worst;
        const wb = y.plan.valuation.worst;
        return STATUS_ORDER[statusKind(x.plan)] - STATUS_ORDER[statusKind(y.plan)] || Math.abs(wb.drift) / wb.tolerance - Math.abs(wa.drift) / wa.tolerance;
      }),
    [rows],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[statusKind(r.plan)] = (c[statusKind(r.plan)] ?? 0) + 1;
    return c;
  }, [rows]);
  const shown = sorted.filter((r) => (filter === 'all' || statusKind(r.plan) === filter) && r.plan.clientName.toLowerCase().includes(q.trim().toLowerCase()));

  // Kalendář: všechny události všech klientů, se značkami změn proti výchozímu stavu.
  const events = useMemo(() => agendaWithChanges(agenda(data.asOf, plans), agenda(data.asOf, basePlans)), [data.asOf, plans, basePlans]);
  const live = events.filter((e) => e.change !== 'removed').map((e) => e.ev);
  // Osa končí posledním obchodem nebo pohybem; vzdálenější daňová osvobození jsou jen v seznamu.
  const horizonEnd = addDays(data.asOf, s.horizonDays);
  const axisEnd = addDays(live.reduce((a, e) => (e.kind !== 'exempt' && e.date > a ? e.date : a), horizonEnd), 10);
  const near = live.filter((e) => e.date <= axisEnd);
  const kinds = [...new Set(near.map((e) => timelineItem(e).kind))] as TLKind[];

  // Složení celého spravovaného majetku: teď, po navržených zásazích a cíl.
  const series: Series[] = [...data.instruments.map((i) => ({ key: i.ticker, name: i.ticker, sub: i.assetClass, color: assetColor(data, i.ticker) })), { key: CASH, name: 'Hotovost', color: assetColor(data, CASH) }].filter((x) =>
    plans.some((p) => p.valuation.assets.some((a) => a.key === x.key)),
  );
  const agg = (f: (p: Plan) => { key: string; valueCzk: number }[]) => {
    const out: Record<string, number> = {};
    for (const p of plans) for (const a of f(p)) out[a.key] = (out[a.key] ?? 0) + a.valueCzk;
    return out;
  };
  const projected = sum(plans.map((p) => p.projectedTotalCzk));
  const targetCzk = agg((p) => p.valuation.assets.map((a) => ({ key: a.key, valueCzk: a.target * p.projectedTotalCzk })));
  const target = Object.fromEntries(Object.entries(targetCzk).map(([k, v]) => [k, projected > 0 ? v / projected : 0]));

  const maxOff = Math.max(0.0001, ...rows.map((r) => offTargetCzk(r.plan.valuation.assets, 1)));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Přehled portfolií</h1>
          <p className="lead">
            {rows.length} klientů, ocenění k {day(data.asOf)}. Nejdřív celkový obraz, pod ním kalendář všech akcí a jednotliví klienti.
          </p>
        </div>
        <button className="btn" onClick={() => download(`pokyny-${data.asOf}.csv`, ordersCsv(data, plans))} disabled={t.orders === 0}>
          Stáhnout všechny pokyny (CSV)
        </button>
      </div>

      {compare && <CompareAll rows={rows} />}

      <section className="kpis">
        <Kpi label="Spravovaný majetek" value={mil(t.aum)} hint={`${rows.length} klientů`} />
        <Kpi
          label="Na cílové alokaci"
          value={pct(1 - t.off / t.aum)}
          hint={`mimo cíl ${mil(t.off)}, po zásazích ${mil(t.offAfter)}`}
          delta={<Delta value={t.offAfter - b.offAfter} tone="cost" format={(x) => `${x > 0 ? '+' : '−'}${mil(Math.abs(x))} mimo cíl po zásazích`} suffix="" />}
        />
        <Kpi label="Klienti k zásahu" value={`${t.acting} z ${rows.length}`} hint={`${rows.length - t.acting} v pásmu, bez obchodu`} delta={<Delta value={t.acting - b.acting} format={(x) => `${x > 0 ? '+' : '−'}${Math.abs(x)}`} />} />
        <Kpi
          label="Práce před námi"
          value={`${t.orders} pokynů`}
          hint={t.lastDay ? `obchodních dnů: ${t.days}, poslední ${day(t.lastDay)} · obrat ${mil(t.turnover)}` : 'žádný obchod'}
          delta={<Delta value={t.orders - b.orders} format={(x) => `${x > 0 ? '+' : '−'}${Math.abs(x)} pokynů`} />}
        />
        <Kpi
          label="Náklady zásahů"
          value={czk(t.fees + t.tax)}
          hint={`poplatky ${czk(t.fees)} · daň ${czk(t.tax)}${saved > 0 ? ` · čekáním ušetřeno ${czk(saved)}` : ''}`}
          delta={<Delta value={t.fees + t.tax - b.fees - b.tax} tone="cost" />}
        />
      </section>

      <div className="two">
        <section className="card">
          <h2>Jak daleko jsou klienti od cíle</h2>
          <p className="muted">Podíl portfolia, který by se musel přesunout, aby váhy seděly přesně na cíl. Čárka ukazuje stav po navrženém zásahu.</p>
          <div className="offbars">
            {sorted.map((r) => {
              const v = r.plan.valuation;
              const now = offTargetCzk(v.assets, 1);
              const after = offTargetCzk(r.plan.after, 1);
              const href = `#/klient/${encodeURIComponent(v.client.name)}`;
              return (
                <a key={v.client.name} className="offbar" href={href}>
                  <span className="offbar-name">{v.client.name}</span>
                  <span className="offbar-track" role="img" aria-label={`${v.client.name}: mimo cíl ${pct(now)}, po zásahu ${pct(after)}`}>
                    <span className="offbar-fill" style={{ width: `${(now / maxOff) * 100}%` }} />
                    {r.plan.status !== 'none' && <span className="offbar-after" style={{ left: `${(after / maxOff) * 100}%` }} />}
                  </span>
                  <span className="offbar-val">
                    <strong>{pct(now)}</strong>
                    <span className="sub-inline">{mil(now * v.totalCzk)}</span>
                  </span>
                </a>
              );
            })}
          </div>
          <div className="chart-legend">
            <span>
              <i className="key-bar" />
              teď
            </span>
            <span>
              <i className="key-tick" />
              po zásahu
            </span>
          </div>
        </section>

        <section className="card">
          <h2>Složení spravovaného majetku</h2>
          <p className="muted">Všichni klienti dohromady. Cíl je vážený majetkem jednotlivých klientů.</p>
          <Allocation
            series={series}
            states={[
              { title: 'Teď', sub: mil(t.aum), values: agg((p) => p.valuation.assets) },
              { title: 'Po zásazích', sub: mil(projected), values: agg((p) => p.after) },
            ]}
            target={target}
          />
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Kalendář akcí</h2>
          <TimelineLegend kinds={kinds} />
        </div>
        <p className="muted">
          Všechny obchody, vklady, výběry a daňová osvobození napříč klienty podle data. Do návrhu se počítají pohyby v příštích {s.horizonDays} dnech; vzdálenější jsou vidět,
          ale zatím se s nimi neobchoduje.
        </p>
        <Timeline
          lanes={rows.map((r) => ({
            label: r.plan.clientName,
            href: `#/klient/${encodeURIComponent(r.plan.clientName)}`,
            items: near.filter((e) => e.clientName === r.plan.clientName).map(timelineItem),
          }))}
          from={data.asOf}
          to={axisEnd}
          horizonEnd={horizonEnd}
          spread
        />
        <Agenda asOf={data.asOf} rows={events} showClient foldAfter={horizonEnd} />
      </section>

      <section className="card">
        <div className="toolbar">
          <h2>Klienti</h2>
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
              {shown.map(({ plan: p, diff }) => {
                const w = p.valuation.worst;
                const c = p.valuation.client;
                const href = `#/klient/${encodeURIComponent(c.name)}`;
                return (
                  <tr key={c.name} className={`row-link ${diff.changed ? 'row-changed' : ''}`} onClick={() => (window.location.hash = href)}>
                    <td>
                      <a href={href} className="client-name" onClick={(e) => e.stopPropagation()}>
                        {c.name}
                      </a>{' '}
                      {diff.changed && <ChangeTag kind="changed" />}
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
                    <td className="num">
                      {p.costCzk > 0 ? czk(p.costCzk) : '–'}
                      <div>
                        <Delta value={diff.delta.costCzk} tone="cost" suffix="" />
                      </div>
                    </td>
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
    </>
  );
}
