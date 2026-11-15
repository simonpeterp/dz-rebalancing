import { useEffect, useMemo, useState } from 'react';
import { VARIANT_LABEL, czk, day } from '../../adapters/cs';
import { parseWorkbook } from '../../adapters/excel';
import { DEFAULT_SETTINGS, diffDays, diffPlans, recommend, type CashFlow, type Dataset, type Plan, type PlanDiff, type Recommendation, type Settings, type VariantKey } from '../../engine';
import { ChangeBar } from './Changes';
import { ClientDetail } from './ClientDetail';
import { Dashboard } from './Dashboard';
import { Guide } from './Guide';
import { RulesPanel } from './RulesPanel';
import { settingsChanges } from './rules';
import { todayISO } from './ui';

const SAMPLE = 'data/DZ_case_study_rebalancing_data.xlsx';
const store = {
  get<T>(k: string): T | null {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown) {
    try {
      v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* úložiště nemusí být dostupné */
    }
  },
};

export type Variant = VariantKey;
/** Všechno, co uživatel může změnit a co ovlivňuje výsledek. */
interface Scenario {
  settings: Settings;
  simFlows: CashFlow[];
  variants: Record<string, Variant>;
}
/**
 * Jeden klient: doporučení, zobrazený plán (doporučená nebo ručně zvolená varianta),
 * plán ve výchozím stavu a rozdíl mezi nimi.
 */
export interface Row {
  rec: Recommendation;
  plan: Plan;
  base: Plan;
  diff: PlanDiff;
}

function compute(data: Dataset, sc: Scenario) {
  const effective: Dataset = { ...data, cashFlows: [...data.cashFlows, ...sc.simFlows] };
  const items = effective.clients.map((c) => {
    const rec = recommend(effective, c.name, sc.settings);
    const v = sc.variants[c.name];
    const plan = v === 'wait' && rec.waitPlan ? rec.waitPlan : v === 'staged' && rec.stagedPlan ? rec.stagedPlan : v === 'now' ? rec.nowPlan : rec.plan;
    return { rec, plan };
  });
  return { effective, items };
}

const useHash = () => {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
};

const flowText = (f: CashFlow) => `${f.client}: ${f.amountCzk > 0 ? 'vklad' : 'výběr'} ${czk(Math.abs(f.amountCzk))} ${day(f.date)}`;

export function App() {
  const [data, setData] = useState<Dataset | null>(() => store.get<Dataset>('dz.dataset'));
  const [source, setSource] = useState<string>(() => store.get<string>('dz.source') ?? 'Ukázková data ze zadání');
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...(store.get<Settings>('dz.settings') ?? {}) }));
  const [simFlows, setSimFlows] = useState<CashFlow[]>([]);
  const [variants, setVariants] = useState<Record<string, Variant>>({});
  const [baseline, setBaseline] = useState<Scenario>(() => ({ settings, simFlows: [], variants: {} }));
  const [compare, setCompare] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(() => window.matchMedia('(min-width: 1280px)').matches);
  const [guide, setGuide] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const hash = useHash();

  /** Nová data = nový výchozí stav. Pravidla zůstávají, simulace a ruční volby se zahodí. */
  const reset = (dataset: Dataset, name: string, w: string[], persist: boolean) => {
    setData(dataset);
    setSource(name);
    setWarnings(w);
    setSimFlows([]);
    setVariants({});
    setBaseline({ settings, simFlows: [], variants: {} });
    setCompare(false);
    store.set('dz.dataset', persist ? dataset : null);
    store.set('dz.source', persist ? name : null);
    setError(null);
  };
  const loadSample = async () => {
    try {
      const res = await fetch(SAMPLE);
      const { dataset } = parseWorkbook(await res.arrayBuffer());
      reset(dataset, 'Ukázková data ze zadání', [], false);
    } catch (e) {
      setError(`Ukázková data se nepodařilo načíst: ${(e as Error).message}`);
    }
  };
  const upload = async (file: File) => {
    try {
      const { dataset, warnings: w } = parseWorkbook(await file.arrayBuffer());
      reset(dataset, file.name, w, true);
    } catch (e) {
      setError(`Soubor se nepodařilo načíst. ${(e as Error).message}`);
    }
  };
  useEffect(() => {
    if (!data) void loadSample();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    store.set('dz.settings', settings);
  }, [settings]);

  const current = useMemo(() => (data ? compute(data, { settings, simFlows, variants }) : null), [data, settings, simFlows, variants]);
  const base = useMemo(() => (data ? compute(data, baseline) : null), [data, baseline]);
  const rows = useMemo<Row[]>(() => {
    if (!current || !base) return [];
    return current.items.map((it, i) => {
      const b = base.items[i].plan;
      return { ...it, base: b, diff: diffPlans(b, it.plan) };
    });
  }, [current, base]);

  // Co uživatel změnil, jako krátké věty do lišty změn.
  const changes = useMemo(() => {
    const out = settingsChanges(baseline.settings, settings);
    for (const f of simFlows) if (!baseline.simFlows.includes(f)) out.push(flowText(f));
    for (const f of baseline.simFlows) if (!simFlows.includes(f)) out.push(`Odebráno: ${flowText(f)}`);
    for (const r of rows)
      if (r.plan.variant !== r.base.variant && variants[r.plan.clientName] !== baseline.variants[r.plan.clientName])
        out.push(`${r.plan.clientName}: varianta ${VARIANT_LABEL[r.plan.variant]}`);
    return out;
  }, [baseline, settings, simFlows, variants, rows]);
  const dirty = changes.length > 0 || rows.some((r) => r.diff.changed);
  // Pravidla se ukládají v prohlížeči. Liší-li se od výchozích, musí to být vidět, jinak čísla nesedí s dokumentací.
  const custom = useMemo(() => settingsChanges(DEFAULT_SETTINGS, settings), [settings]);
  const age = data ? diffDays(data.asOf, todayISO()) : 0;
  useEffect(() => {
    if (!dirty) setCompare(false);
  }, [dirty]);

  const selected = hash.startsWith('#/klient/') ? decodeURIComponent(hash.slice(9)) : null;
  const row = selected ? rows.find((r) => r.plan.clientName === selected) : undefined;
  useEffect(() => {
    window.scrollTo(0, 0); // ve složených závorkách: novější prohlížeče vracejí Promise a React by ho bral jako úklidovou funkci
  }, [selected]);

  return (
    <>
      <header className="top">
        <div className="wrap top-in">
          <a className="brand" href="#/">
            <span className="brand-mark" aria-hidden="true" />
            <span>
              <strong>Rebalancování portfolií</strong>
              <small>Case study pro Dvořák &amp; Zedník</small>
            </span>
          </a>
          <div className="top-right">
            {data && (
              <span className="top-meta">
                Ocenění k {day(data.asOf)}
                {age > 0 && ` (před ${age} ${age === 1 ? 'dnem' : 'dny'})`} · {source}
              </span>
            )}
            <button className="btn btn-dark" onClick={() => setGuide((x) => !x)} aria-expanded={guide}>
              Jak to číst
            </button>
            <button className="btn btn-accent" onClick={() => setRulesOpen((x) => !x)} aria-expanded={rulesOpen} aria-controls="pravidla">
              {rulesOpen ? 'Skrýt pravidla' : 'Pravidla a data'}
            </button>
          </div>
        </div>
      </header>

      <div className={`wrap shell ${rulesOpen ? '' : 'shell-closed'}`}>
        {rulesOpen && (
          <aside className="rules-side" id="pravidla" aria-label="Pravidla a data">
            <RulesPanel
              settings={settings}
              baseline={baseline.settings}
              onChange={setSettings}
              onUpload={upload}
              onSample={loadSample}
              source={source}
              asOf={data?.asOf ?? null}
              sampleUrl={SAMPLE}
            />
          </aside>
        )}

        <main className="main">
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="alert alert-warn">
              {warnings.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
          )}
          {guide && <Guide onClose={() => setGuide(false)} />}
          {custom.length > 0 && (
            <div className="notice">
              <span>
                <strong>Pravidla se liší od výchozích.</strong> {custom.join(' · ')}
              </span>
              <button className="link" onClick={() => setSettings(DEFAULT_SETTINGS)}>
                Obnovit výchozí
              </button>
            </div>
          )}
          {!current ? (
            !error && <p className="muted">Načítám data…</p>
          ) : row ? (
            <ClientDetail
              data={current.effective}
              row={row}
              settings={settings}
              compare={compare && dirty}
              simFlows={simFlows.filter((f) => f.client === selected)}
              onAddFlow={(f) => setSimFlows((x) => [...x, f])}
              onRemoveFlow={(f) => setSimFlows((x) => x.filter((y) => y !== f))}
              onVariant={(v) => setVariants((x) => ({ ...x, [row.plan.clientName]: v }))}
            />
          ) : (
            <Dashboard data={current.effective} rows={rows} settings={settings} compare={compare && dirty} />
          )}

          {dirty && (
            <ChangeBar
              changes={changes}
              rows={rows}
              compare={compare}
              onCompare={() => {
                setCompare((x) => !x);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onRevert={() => {
                setSettings(baseline.settings);
                setSimFlows(baseline.simFlows);
                setVariants(baseline.variants);
              }}
              onConfirm={() => setBaseline({ settings, simFlows, variants })}
            />
          )}
        </main>
      </div>

      <footer className="wrap foot">
        Všechna data jsou smyšlená. Výpočty běží jen ve vašem prohlížeči, nic se nikam neodesílá. Ceny a kurzy jsou k datu ocenění; grafy v čase a
        počty kusů u pozdějších obchodů počítají s dnešními cenami.
      </footer>
    </>
  );
}
