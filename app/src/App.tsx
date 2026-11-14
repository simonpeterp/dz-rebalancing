import { useEffect, useMemo, useState } from 'react';
import { day } from '../../adapters/cs';
import { parseWorkbook } from '../../adapters/excel';
import { DEFAULT_SETTINGS, recommend, type CashFlow, type Dataset, type Plan, type Recommendation, type Settings } from '../../engine';
import { ClientDetail } from './ClientDetail';
import { Dashboard } from './Dashboard';
import { SettingsDrawer } from './SettingsDrawer';

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

export type Variant = 'now' | 'wait';
/** Doporučení + varianta, kterou si portfolio manažer vybral (nebo doporučená). */
export interface Row {
  rec: Recommendation;
  plan: Plan;
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

export function App() {
  const [data, setData] = useState<Dataset | null>(() => store.get<Dataset>('dz.dataset'));
  const [source, setSource] = useState<string>(() => store.get<string>('dz.source') ?? 'Ukázková data ze zadání');
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...(store.get<Settings>('dz.settings') ?? {}) }));
  const [simFlows, setSimFlows] = useState<CashFlow[]>([]);
  const [variants, setVariants] = useState<Record<string, Variant>>({});
  const [drawer, setDrawer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const hash = useHash();

  const loadSample = async () => {
    try {
      const res = await fetch(SAMPLE);
      const { dataset } = parseWorkbook(await res.arrayBuffer());
      setData(dataset);
      setSource('Ukázková data ze zadání');
      setWarnings([]);
      setSimFlows([]);
      store.set('dz.dataset', null);
      store.set('dz.source', null);
      setError(null);
    } catch (e) {
      setError(`Ukázková data se nepodařilo načíst: ${(e as Error).message}`);
    }
  };
  useEffect(() => {
    if (!data) void loadSample();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => store.set('dz.settings', settings), [settings]);

  const upload = async (file: File) => {
    try {
      const { dataset, warnings: w } = parseWorkbook(await file.arrayBuffer());
      setData(dataset);
      setSource(file.name);
      setWarnings(w);
      setSimFlows([]);
      setVariants({});
      store.set('dz.dataset', dataset);
      store.set('dz.source', file.name);
      setError(null);
    } catch (e) {
      setError(`Soubor se nepodařilo načíst. ${(e as Error).message}`);
    }
  };

  const effective = useMemo(() => (data ? { ...data, cashFlows: [...data.cashFlows, ...simFlows] } : null), [data, simFlows]);
  const rows = useMemo<Row[]>(() => {
    if (!effective) return [];
    return effective.clients.map((c) => {
      const rec = recommend(effective, c.name, settings);
      const v = variants[c.name];
      const plan = v === 'wait' && rec.waitPlan ? rec.waitPlan : v === 'now' ? rec.nowPlan : rec.plan;
      return { rec, plan };
    });
  }, [effective, settings, variants]);

  const selected = hash.startsWith('#/klient/') ? decodeURIComponent(hash.slice(9)) : null;
  const row = selected ? rows.find((r) => r.plan.clientName === selected) : undefined;
  useEffect(() => window.scrollTo(0, 0), [selected]);

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
                Ocenění k {day(data.asOf)} · {source}
              </span>
            )}
            <button className="btn btn-accent" onClick={() => setDrawer(true)}>
              Data a pravidla
            </button>
          </div>
        </div>
      </header>

      <main className="wrap">
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
        {!effective ? (
          !error && <p className="muted">Načítám data…</p>
        ) : row ? (
          <ClientDetail
            data={effective}
            row={row}
            settings={settings}
            simFlows={simFlows.filter((f) => f.client === selected)}
            onAddFlow={(f) => setSimFlows((x) => [...x, f])}
            onRemoveFlow={(f) => setSimFlows((x) => x.filter((y) => y !== f))}
            onVariant={(v) => setVariants((x) => ({ ...x, [row.plan.clientName]: v }))}
          />
        ) : (
          <Dashboard data={effective} rows={rows} settings={settings} />
        )}
      </main>

      <footer className="wrap foot">
        Všechna data jsou smyšlená. Výpočty běží jen ve vašem prohlížeči, nic se nikam neodesílá. Ceny a kurzy jsou k datu ocenění; počty kusů u
        pozdějších obchodů jsou orientační.
      </footer>

      {drawer && (
        <SettingsDrawer
          settings={settings}
          onChange={setSettings}
          onClose={() => setDrawer(false)}
          onUpload={upload}
          onSample={loadSample}
          source={source}
          sampleUrl={SAMPLE}
        />
      )}
    </>
  );
}
