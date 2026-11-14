import { useState } from 'react';
import { czk, day, explain, label, money, pct, pp, qty, statusKind } from '../../adapters/cs';
import { ordersCsv } from '../../adapters/csv';
import { addDays, isExemptOn, taxRate, type CashFlow, type Dataset, type Settings } from '../../engine';
import type { Row, Variant } from './App';
import { DriftBar, Kpi, StatusChip, download } from './ui';

interface Props {
  data: Dataset;
  row: Row;
  settings: Settings;
  simFlows: CashFlow[];
  onAddFlow: (f: CashFlow) => void;
  onRemoveFlow: (f: CashFlow) => void;
  onVariant: (v: Variant) => void;
}

export function ClientDetail({ data, row, settings: s, simFlows, onAddFlow, onRemoveFlow, onVariant }: Props) {
  const { rec, plan: p } = row;
  const v = p.valuation;
  const c = v.client;
  const rate = taxRate(c.taxRegime, s);
  const [saleDate, setSaleDate] = useState(addDays(data.asOf, 30));
  const [simAmount, setSimAmount] = useState('');
  const [simKind, setSimKind] = useState<'out' | 'in'>('out');
  const [simDate, setSimDate] = useState(addDays(data.asOf, 14));

  const shownRec = { ...rec, plan: p };
  const taxOn = (l: (typeof v.lots)[number], date: string) => (isExemptOn(l.exemptFrom, date) ? 0 : Math.max(0, l.gainCzk) * rate);
  const flows = [...p.flows, ...p.flowsLater];
  const addSim = () => {
    const amount = Number(simAmount.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0 || simDate <= data.asOf) return;
    onAddFlow({ client: c.name, date: simDate, amountCzk: simKind === 'out' ? -amount : amount, note: 'Simulace' });
    setSimAmount('');
  };

  return (
    <>
      <a className="back" href="#/">
        ← Přehled portfolií
      </a>
      <div className="page-head">
        <div>
          <h1>{c.name}</h1>
          <p className="lead">
            {c.profile} · {c.taxRegime === 'FO' ? 'fyzická osoba' : 'právnická osoba (s.r.o.)'}
            {c.note && <> · {c.note}</>}
          </p>
        </div>
        <StatusChip kind={statusKind(p)} />
      </div>

      <section className="kpis">
        <Kpi label="Majetek" value={czk(v.totalCzk)} hint={p.netFlowCzk !== 0 ? `po cash flow ${czk(p.projectedTotalCzk)}` : 'bez plánovaných pohybů'} />
        <Kpi label="Objem obchodů" value={czk(p.turnoverCzk)} hint={`prodej ${czk(p.sellCzk)} · nákup ${czk(p.buyCzk)}`} />
        <Kpi label="Poplatky" value={czk(p.feesCzk)} hint={`${String(s.feePct).replace('.', ',')} %, nejméně ${czk(s.feeMinCzk)} za obchod`} />
        <Kpi label="Daň" value={czk(p.taxCzk)} hint={p.exemptGainCzk > 0 ? `osvobozený zisk ${czk(p.exemptGainCzk)}` : `sazba ${Math.round(rate * 100)} %`} />
        <Kpi label="Náklady celkem" value={czk(p.costCzk)} hint={`${pct(p.costCzk / p.projectedTotalCzk)} majetku`} />
      </section>

      <section className="card reco">
        <h2>Doporučení a důvody</h2>
        <ul className="reasons">
          {explain(shownRec, s).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {rec.waitPlan && (
          <div className="variants" role="group" aria-label="Varianta provedení">
            {(
              [
                ['wait', `Počkat do ${day(rec.waitPlan.deferredUntil!)}`, rec.waitPlan],
                ['now', 'Prodat všechno hned', rec.nowPlan],
              ] as const
            ).map(([key, title, plan]) => (
              <button key={key} className={`variant ${p === plan ? 'on' : ''}`} onClick={() => onVariant(key)} aria-pressed={p === plan}>
                <span className="variant-title">
                  {title}
                  {rec.plan === plan && <em>doporučeno</em>}
                </span>
                <span className="variant-num">daň {czk(plan.taxCzk)}</span>
                <span className="sub">poplatky {czk(plan.feesCzk)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Portfolio proti cíli</h2>
        <div className="scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Aktivum</th>
                <th className="num">Hodnota</th>
                <th className="num">Váha</th>
                <th className="num">Cíl</th>
                <th className="num">Odchylka</th>
                <th>
                  Vůči pásmu <span className="legend">● teď ○ po zásahu</span>
                </th>
                <th className="num">Po zásahu</th>
              </tr>
            </thead>
            <tbody>
              {v.assets.map((a, i) => (
                <tr key={a.key}>
                  <td>
                    <strong>{label(a.key)}</strong>
                    <div className="sub">{a.name === 'Hotovost' ? 'všechny měny v CZK' : a.name}</div>
                  </td>
                  <td className="num">{czk(a.valueCzk)}</td>
                  <td className="num">{pct(a.weight)}</td>
                  <td className="num">{pct(a.target)}</td>
                  <td className={`num ${a.breached ? 'bad' : ''}`}>{pp(a.drift)}</td>
                  <td>
                    <div className="drift-cell">
                      <DriftBar drift={a.drift} tolerance={a.tolerance} after={p.status === 'none' ? undefined : p.after[i].drift} />
                      <span className="sub-inline">±{pp(a.tolerance).replace('+', '')}</span>
                    </div>
                  </td>
                  <td className="num">{pct(p.after[i].weight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p.netFlowCzk !== 0 && <p className="muted">Váhy „po zásahu“ jsou z majetku po plánovaných vkladech a výběrech ({czk(p.projectedTotalCzk)}).</p>}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Co koupit a prodat</h2>
          {p.stages.length > 0 && (
            <button className="btn" onClick={() => download(`pokyny-${c.name.replace(/\s+/g, '-')}-${data.asOf}.csv`, ordersCsv(data, [p]))}>
              Stáhnout pokyny (CSV)
            </button>
          )}
        </div>
        {p.stages.length === 0 ? (
          <p className="empty">Žádný obchod. Portfolio je v tolerančním pásmu.</p>
        ) : (
          p.stages.map((st) => (
            <div key={st.date} className="stage">
              <h3>
                {st.isNow ? 'Hned' : day(st.date)}
                <span className="sub-inline">
                  {st.isNow ? `k ocenění ${day(st.date)}` : st.trades.some((t) => t.lots.some((l) => l.deferred)) ? 'po splnění časového testu' : 'po připsání vkladu'}
                </span>
              </h3>
              <div className="scroll">
                <table className="tbl tbl-trades">
                  <thead>
                    <tr>
                      <th>Akce</th>
                      <th>Instrument</th>
                      <th className="num">Kusy</th>
                      <th className="num">Částka</th>
                      <th className="num">V měně</th>
                      <th className="num">Poplatek</th>
                      <th>Z kterých nákupů</th>
                    </tr>
                  </thead>
                  <tbody>
                    {st.trades.map((t) => (
                      <tr key={t.side + t.ticker}>
                        <td>
                          <span className={`side side-${t.side}`}>{t.side === 'buy' ? 'Nákup' : 'Prodej'}</span>
                        </td>
                        <td>
                          <strong>{t.ticker}</strong>
                        </td>
                        <td className="num">{qty(t.qty)}</td>
                        <td className="num">{czk(t.czk)}</td>
                        <td className="num">{money(t.amountLocal, t.currency)}</td>
                        <td className="num">{czk(t.feeCzk)}</td>
                        <td>
                          {t.lots.map((l) => (
                            <div key={l.buyDate} className="lotline">
                              {day(l.buyDate)}: {qty(l.qty)} ks ·{' '}
                              {l.exempt ? <span className="ok">osvobozeno</span> : <span className="bad">zdanitelný zisk {czk(l.gainCzk)}</span>}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Daň podle data prodeje</h2>
          <label className="field-inline">
            Prodej k datu
            <input type="date" value={saleDate} min={data.asOf} onChange={(e) => e.target.value && setSaleDate(e.target.value)} />
          </label>
        </div>
        <p className="muted">
          Kolik by stál prodej celé pozice dnes a kolik k vybranému datu (při dnešních cenách).{' '}
          {c.taxRegime === 'FO' ? `Fyzická osoba: ${s.taxRateFO} %, po ${s.timeTestYears} letech osvobozeno.` : `Právnická osoba: ${s.taxRatePO} % bez časového testu.`}
        </p>
        <div className="scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Pozice</th>
                <th className="num">Kusy</th>
                <th className="num">Hodnota</th>
                <th className="num">Zisk</th>
                <th>Osvobozeno od</th>
                <th className="num">Daň dnes</th>
                <th className="num">Daň {day(saleDate)}</th>
              </tr>
            </thead>
            <tbody>
              {v.lots.map((l) => {
                const now = taxOn(l, data.asOf);
                const then = taxOn(l, saleDate);
                return (
                  <tr key={l.ticker + l.buyDate}>
                    <td>
                      <strong>{l.ticker}</strong> <span className="sub-inline">nákup {day(l.buyDate)}</span>
                    </td>
                    <td className="num">{qty(l.qty)}</td>
                    <td className="num">{czk(l.valueCzk)}</td>
                    <td className={`num ${l.gainCzk < 0 ? 'bad' : ''}`}>{czk(l.gainCzk)}</td>
                    <td>
                      {l.exemptFrom === null ? (
                        <span className="sub-inline">nikdy (s.r.o.)</span>
                      ) : l.exemptNow ? (
                        <span className="ok">už osvobozeno</span>
                      ) : (
                        <>
                          {day(l.exemptFrom)} <span className="sub-inline">za {l.daysToExempt} dnů</span>
                        </>
                      )}
                    </td>
                    <td className="num">{czk(now)}</td>
                    <td className={`num ${then < now ? 'ok strong' : ''}`}>{czk(then)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>Celkem při prodeji všeho</td>
                <td className="num">{czk(v.lots.reduce((a, l) => a + taxOn(l, data.asOf), 0))}</td>
                <td className="num">{czk(v.lots.reduce((a, l) => a + taxOn(l, saleDate), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Vklady a výběry</h2>
        {flows.length === 0 ? (
          <p className="muted">Žádné plánované pohyby.</p>
        ) : (
          <table className="tbl">
            <tbody>
              {flows.map((f, i) => (
                <tr key={i} className={f.date > p.horizonEnd ? 'dim' : ''}>
                  <td>{day(f.date)}</td>
                  <td>
                    {f.note}
                    {f.date > p.horizonEnd && <span className="sub-inline"> · za horizontem</span>}
                  </td>
                  <td className={`num ${f.amountCzk > 0 ? 'pos' : ''}`}>{(f.amountCzk > 0 ? '+' : '−') + czk(Math.abs(f.amountCzk))}</td>
                  <td className="num">
                    {simFlows.includes(f) && (
                      <button className="link" onClick={() => onRemoveFlow(f)}>
                        Odebrat
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="sim">
          <strong>Co kdyby: klient chce vybrat nebo vložit peníze</strong>
          <div className="sim-row">
            <select value={simKind} onChange={(e) => setSimKind(e.target.value as 'out' | 'in')} aria-label="Typ pohybu">
              <option value="out">Výběr</option>
              <option value="in">Vklad</option>
            </select>
            <input type="text" inputMode="numeric" placeholder="Částka v Kč" aria-label="Částka v Kč" value={simAmount} onChange={(e) => setSimAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSim()} />
            <input type="date" aria-label="Datum" value={simDate} min={addDays(data.asOf, 1)} onChange={(e) => e.target.value && setSimDate(e.target.value)} />
            <button className="btn btn-ink" onClick={addSim}>
              Přepočítat návrh
            </button>
          </div>
          <p className="muted">Nástroj hned ukáže, které kusy prodat, aby výběr stál na dani co nejméně. Simulace se neukládá.</p>
        </div>
      </section>
    </>
  );
}
