import { useMemo, useState } from 'react';
import { czk, day, doneDate, explain, label, money, pct, pp, qty, signed, statusKind, summary, tradeCount, variantTitle } from '../../adapters/cs';
import { ordersCsv } from '../../adapters/csv';
import { CASH, addDays, agenda, driftPath, isExemptOn, planEnd, shockEffect, taxRate, type CashFlow, type ChangeKind, type Dataset, type Plan, type Settings, type Trade } from '../../engine';
import { Agenda, agendaWithChanges, eventText } from './Agenda';
import type { Row, Variant } from './App';
import { CompareClient } from './Changes';
import { Allocation, DriftOverTime, Timeline, TimelineLegend, type Series, type TLItem, type TLKind } from './charts';
import { ChangeTag, Delta, DriftBar, Kpi, StatusChip, assetColor, download } from './ui';

interface Props {
  data: Dataset;
  row: Row;
  settings: Settings;
  compare: boolean;
  simFlows: CashFlow[];
  onAddFlow: (f: CashFlow) => void;
  onRemoveFlow: (f: CashFlow) => void;
  onVariant: (v: Variant) => void;
}

export function ClientDetail({ data, row, settings: s, compare, simFlows, onAddFlow, onRemoveFlow, onVariant }: Props) {
  const { rec, plan: p, base, diff } = row;
  const v = p.valuation;
  const c = v.client;
  const rate = taxRate(c.taxRegime, s);
  const [saleDate, setSaleDate] = useState(addDays(data.asOf, 30));
  const [simAmount, setSimAmount] = useState('');
  const [simKind, setSimKind] = useState<'out' | 'in'>('in');
  // Výchozí datum simulace je dnešek. Musí ale být po datu ocenění (starší pohyby už jsou
  // v zůstatcích) a v horizontu, jinak by se s pohybem neobchodovalo a nic by se nezměnilo.
  const [simDate, setSimDate] = useState(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const first = addDays(data.asOf, 1);
    return today < first ? first : today > p.horizonEnd ? p.horizonEnd : today;
  });

  const shownRec = { ...rec, plan: p };
  const taxOn = (l: (typeof v.lots)[number], date: string) => (isExemptOn(l.exemptFrom, date) ? 0 : Math.max(0, l.gainCzk) * rate);
  const flows = [...p.flows, ...p.flowsLater];
  const addSim = () => {
    const amount = Number(simAmount.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0 || simDate <= data.asOf) return;
    onAddFlow({ client: c.name, date: simDate, amountCzk: simKind === 'out' ? -amount : amount, note: 'Simulace' });
    setSimAmount('');
  };

  // Varianty provedení a co která obnáší.
  const options = ([rec.nowPlan, rec.waitPlan, rec.stagedPlan].filter(Boolean) as Plan[]).map((plan) => ({ plan, shock: shockEffect(plan, rec.nowPlan, s.shockPct) }));

  // Grafy: složení, vývoj odchylky v čase, časová osa.
  const hasTrades = p.stages.length > 0;
  const until = planEnd(p);
  const path = useMemo(() => driftPath(data.asOf, p, { trades: true, until }), [data.asOf, p, until]);
  const idle = useMemo(() => driftPath(data.asOf, p, { trades: false, until }), [data.asOf, p, until]);
  const series: Series[] = v.assets.map((a) => ({ key: a.key, name: label(a.key), sub: a.key === CASH ? undefined : a.name, color: assetColor(data, a.key) }));
  const values = (rows: { key: string; valueCzk: number }[]) => Object.fromEntries(rows.map((a) => [a.key, a.valueCzk]));

  const events = useMemo(() => agendaWithChanges(agenda(data.asOf, [p]), agenda(data.asOf, [base])), [data.asOf, p, base]);
  const live = events.filter((e) => e.change !== 'removed').map((e) => e.ev);
  // Osa končí posledním obchodem nebo pohybem; vzdálenější osvobození jsou jen v seznamu.
  const axisEnd = addDays(live.reduce((a, e) => (e.kind !== 'exempt' && e.date > a ? e.date : a), p.horizonEnd), 10);
  const beyond = live.filter((e) => e.date > axisEnd).length;
  const item = (e: (typeof live)[number]): TLItem => {
    const t = eventText(e);
    return { date: e.date, kind: e.kind === 'flow' ? (e.amountCzk > 0 ? 'in' : 'out') : e.kind, title: t.tag, detail: e.kind === 'trade' ? t.text : `${t.text} · ${t.amount}` };
  };
  const near = live.filter((e) => e.date <= axisEnd);
  const lanes = [
    { label: 'Obchody', items: near.filter((e) => e.kind === 'trade').map(item) },
    { label: 'Vklady a výběry', items: near.filter((e) => e.kind === 'flow').map(item) },
    { label: 'Časový test', items: near.filter((e) => e.kind === 'exempt').map(item) },
  ].filter((l) => l.items.length > 0);
  const kinds = [...new Set(lanes.flatMap((l) => l.items.map((i) => i.kind)))] as TLKind[];

  // Obchody po etapách, včetně těch, které proti výchozímu stavu zmizely.
  const changeOf = new Map(diff.trades.map((t) => [t.key, t]));
  const stageDates = [...new Set([...p.stages.map((st) => st.date), ...diff.trades.filter((t) => t.kind === 'removed').map((t) => t.date)])].sort();
  const stageNote = (date: string) => {
    const st = p.stages.find((x) => x.date === date);
    if (!st) return 've výchozím stavu, teď zrušeno';
    const part = p.partDates.indexOf(date);
    const notes = [
      st.isNow ? `k ocenění ${day(date)}` : '',
      part >= 0 ? `${part + 1}. část z ${p.parts}` : '',
      st.trades.some((t) => t.lots.some((l) => l.deferred)) ? 'po splnění časového testu' : '',
    ].filter(Boolean);
    return notes.length ? notes.join(' · ') : 'po připsání vkladu';
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

      {compare && <CompareClient row={row} />}

      <section className="card reco">
        <h2>Doporučení</h2>
        <p className="reco-line">{summary(p)}</p>

        {options.length > 1 && (
          <>
            <h3 className="reco-sub">Jak zásah provést</h3>
            <div className="variants" role="group" aria-label="Varianta provedení">
              {options.map(({ plan, shock }) => (
                <button key={plan.variant} className={`variant ${p === plan ? 'on' : ''}`} onClick={() => onVariant(plan.variant)} aria-pressed={p === plan}>
                  <span className="variant-title">
                    {variantTitle(plan)}
                    {rec.recommended === plan.variant && <em>doporučeno</em>}
                  </span>
                  <span className="variant-facts">
                    <span>
                      <small>Hotovo</small>
                      {day(doneDate(plan)!)}
                    </span>
                    <span>
                      <small>Obchodních dnů</small>
                      {plan.stages.length}
                    </span>
                    <span>
                      <small>Pokynů</small>
                      {tradeCount(plan)}
                    </span>
                    <span>
                      <small>Daň</small>
                      {czk(plan.taxCzk)}
                    </span>
                    <span>
                      <small>Poplatky</small>
                      {czk(plan.feesCzk)}
                    </span>
                  </span>
                  <span className="variant-note">
                    {Math.abs(shock.downCzk) >= 1 ? (
                      <>
                        Proti „všechno hned“ při pohybu trhu po první části: −{s.shockPct} % → <b>{signed(shock.downCzk)}</b>, +{s.shockPct} % → <b>{signed(shock.upCzk)}</b>.
                      </>
                    ) : plan.variant === 'now' ? (
                      'Portfolio je na cíli nejdřív. Nákupní i prodejní kurz je daný jedním dnem.'
                    ) : (
                      'Pohyb trhu mezi částmi výsledek nezmění: později se stejně prodává i nakupuje.'
                    )}
                    {plan.variant === 'wait' && rec.waitBreakEvenDrop !== null && <> Vyplatí se, dokud odložené aktivum neztratí víc než {pct(rec.waitBreakEvenDrop)}.</>}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <h3 className="reco-sub">Proč</h3>
        <ul className="reasons">
          {explain(shownRec, s).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="card whatif">
        <div className="whatif-head">
          <h2>Co kdyby: vklad nebo výběr</h2>
          <span className="muted">Návrh se hned přepočítá a změny se zvýrazní. Simulace se neukládá do dat.</span>
        </div>
        <div className="sim-row">
          <select value={simKind} onChange={(e) => setSimKind(e.target.value as 'out' | 'in')} aria-label="Typ pohybu">
            <option value="in">Vklad</option>
            <option value="out">Výběr</option>
          </select>
          <input type="text" inputMode="numeric" placeholder="Částka v Kč" aria-label="Částka v Kč" value={simAmount} onChange={(e) => setSimAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSim()} />
          <input type="date" aria-label="Datum" value={simDate} min={addDays(data.asOf, 1)} onChange={(e) => e.target.value && setSimDate(e.target.value)} />
          <button className="btn btn-ink" onClick={addSim}>
            Přepočítat návrh
          </button>
          {simFlows.map((f, i) => (
            <span key={i} className="sim-chip">
              {f.amountCzk > 0 ? 'Vklad' : 'Výběr'} {czk(Math.abs(f.amountCzk))} · {day(f.date)}
              <button className="link" onClick={() => onRemoveFlow(f)} aria-label="Odebrat simulaci">
                odebrat
              </button>
            </span>
          ))}
        </div>
      </section>

      <section className="kpis">
        <Kpi label="Majetek" value={czk(v.totalCzk)} hint={p.netFlowCzk !== 0 ? `po cash flow ${czk(p.projectedTotalCzk)}` : 'bez plánovaných pohybů'} delta={<Delta value={p.projectedTotalCzk - base.projectedTotalCzk} suffix="po cash flow" />} />
        <Kpi label="Objem obchodů" value={czk(p.turnoverCzk)} hint={`prodej ${czk(p.sellCzk)} · nákup ${czk(p.buyCzk)}`} delta={<Delta value={diff.delta.turnoverCzk} />} />
        <Kpi label="Poplatky" value={czk(p.feesCzk)} hint={`${String(s.feePct).replace('.', ',')} %, nejméně ${czk(s.feeMinCzk)} za pokyn`} delta={<Delta value={diff.delta.feesCzk} tone="cost" />} />
        <Kpi label="Daň" value={czk(p.taxCzk)} hint={p.exemptGainCzk > 0 ? `osvobozený zisk ${czk(p.exemptGainCzk)}` : `sazba ${Math.round(rate * 100)} %`} delta={<Delta value={diff.delta.taxCzk} tone="cost" />} />
        <Kpi label="Náklady celkem" value={czk(p.costCzk)} hint={`${pct(p.costCzk / p.projectedTotalCzk)} majetku`} delta={<Delta value={diff.delta.costCzk} tone="cost" />} />
      </section>

      <div className="two two-charts">
        <section className="card">
          <h2>Složení portfolia</h2>
          <Allocation
            series={series}
            states={[
              { title: 'Teď', sub: `${(v.totalCzk / 1e6).toFixed(2).replace('.', ',')} mil.`, values: values(v.assets) },
              ...(hasTrades || p.netFlowCzk !== 0 ? [{ title: 'Po zásahu', sub: `${(p.projectedTotalCzk / 1e6).toFixed(2).replace('.', ',')} mil.`, values: values(p.after) }] : []),
            ]}
            target={Object.fromEntries(v.assets.map((a) => [a.key, a.target]))}
          />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Co se kdy stane</h2>
            <TimelineLegend kinds={kinds} />
          </div>
          {near.length === 0 ? (
            <p className="empty">Nic naplánovaného: žádný obchod, pohyb ani blížící se osvobození.</p>
          ) : (
            <>
              <Timeline lanes={lanes} from={data.asOf} to={axisEnd} horizonEnd={p.horizonEnd} />
              <p className="muted">
                Najeďte na značku pro podrobnosti. {beyond > 0 ? `Dalších ${beyond} vzdálenějších osvobození a` : 'Všechny události jako'} seznam najdete dole na stránce.
              </p>
            </>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Odchylka od cíle v čase</h2>
        <p className="muted">
          Jak daleko je každé aktivum od cílové váhy (v p. b.) od dneška do {day(until)}. Počítá se s dnešními cenami, takže čára se láme jen v den vkladu, výběru nebo obchodu.
          {p.netFlowCzk < 0 && hasTrades && ' Hotovost připravená na výběr je do dne výběru nad cílem záměrně.'}
        </p>
        <DriftOverTime assets={v.assets} names={label} colorOf={(k) => assetColor(data, k)} plan={path} idle={idle} showIdle={hasTrades} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Co koupit a prodat</h2>
          {hasTrades && (
            <button className="btn" onClick={() => download(`pokyny-${c.name.replace(/\s+/g, '-')}-${data.asOf}.csv`, ordersCsv(data, [p]))}>
              Stáhnout pokyny (CSV)
            </button>
          )}
        </div>
        {stageDates.length === 0 ? (
          <p className="empty">Žádný obchod. Portfolio je v tolerančním pásmu.</p>
        ) : (
          stageDates.map((date) => {
            const st = p.stages.find((x) => x.date === date);
            const rows: { t: Trade; kind: ChangeKind; was: Trade | null }[] = [
              ...(st?.trades ?? []).map((t) => {
                const d = changeOf.get(`${date}|${t.side}|${t.ticker}`);
                return { t, kind: d?.kind ?? 'same', was: d?.before ?? null };
              }),
              ...diff.trades.filter((d) => d.kind === 'removed' && d.date === date).map((d) => ({ t: d.before!, kind: 'removed' as ChangeKind, was: null })),
            ];
            return (
              <div key={date} className="stage">
                <h3>
                  {st?.isNow ? 'Hned' : day(date)}
                  <span className="sub-inline">{stageNote(date)}</span>
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
                      {rows.map(({ t, kind, was }) => (
                        <tr key={t.side + t.ticker + kind} className={kind === 'removed' ? 'row-removed' : kind === 'same' ? '' : 'row-changed'}>
                          <td>
                            <span className={`side side-${t.side}`}>{t.side === 'buy' ? 'Nákup' : 'Prodej'}</span>
                          </td>
                          <td>
                            <strong>{t.ticker}</strong> <ChangeTag kind={kind} />
                          </td>
                          <td className="num">{qty(t.qty)}</td>
                          <td className="num">
                            {czk(t.czk)}
                            {kind === 'changed' && was && Math.abs(was.czk - t.czk) >= 1 && <div className="sub">bylo {czk(was.czk)}</div>}
                          </td>
                          <td className="num">{money(t.amountLocal, t.currency)}</td>
                          <td className="num">
                            {czk(t.feeCzk)}
                            {was && Math.abs(was.feeCzk - t.feeCzk) >= 1 && <div className="sub">bylo {czk(was.feeCzk)}</div>}
                          </td>
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
            );
          })
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
              {v.assets.map((a, i) => {
                const was = base.after[i]?.weight;
                const moved = was !== undefined && Math.abs(was - p.after[i].weight) >= 0.0005;
                return (
                  <tr key={a.key} className={moved ? 'row-changed' : ''}>
                    <td>
                      <span className="swatch" style={{ background: assetColor(data, a.key) }} />
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
                    <td className="num">
                      {pct(p.after[i].weight)}
                      {moved && <div className="sub">bylo {pct(was)}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {p.netFlowCzk !== 0 && <p className="muted">Váhy „po zásahu“ jsou z majetku po plánovaných vkladech a výběrech ({czk(p.projectedTotalCzk)}).</p>}
      </section>

      <details className="card fold">
        <summary>
          <h2>Seznam událostí</h2>
          <span className="muted">
            {live.length} {live.length === 1 ? 'položka' : live.length < 5 && live.length > 0 ? 'položky' : 'položek'}: obchody, vklady, výběry a daňová osvobození podle data
          </span>
        </summary>
        <Agenda asOf={data.asOf} rows={events} showClient={false} />
        {flows.some((f) => f.date > p.horizonEnd) && <p className="muted">Pohyby za horizontem ({day(p.horizonEnd)}) jsou vidět, ale zatím se s nimi neobchoduje.</p>}
      </details>

      <details className="card fold">
        <summary>
          <h2>Jednotlivé nákupy a daň podle data prodeje</h2>
          <span className="muted">{v.lots.length} nákupů · kolik by stál prodej dnes a kolik později</span>
        </summary>
        <div className="card-head">
          <p className="muted">
            Při dnešních cenách. {c.taxRegime === 'FO' ? `Fyzická osoba: ${s.taxRateFO} %, po ${s.timeTestYears} letech osvobozeno.` : `Právnická osoba: ${s.taxRatePO} % bez časového testu.`}
          </p>
          <label className="field-inline">
            Prodej k datu
            <input type="date" value={saleDate} min={data.asOf} onChange={(e) => e.target.value && setSaleDate(e.target.value)} />
          </label>
        </div>
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
      </details>
    </>
  );
}
