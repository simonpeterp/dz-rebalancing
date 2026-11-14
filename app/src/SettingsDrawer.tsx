import { useEffect, useRef } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '../../engine';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
  onUpload: (f: File) => void;
  onSample: () => void;
  source: string;
  sampleUrl: string;
}

type NumKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];

const GROUPS: { title: string; fields: [NumKey, string, string][] }[] = [
  {
    title: 'Toleranční pásma',
    fields: [
      ['absBandPp', 'Absolutní pásmo', 'p. b.'],
      ['relBandPct', 'Relativní pásmo', '% cíle'],
      ['cashBandPp', 'Pásmo hotovosti', 'p. b.'],
      ['minTradePct', 'Nejmenší obchod', '% portfolia'],
    ],
  },
  { title: 'Vklady a výběry', fields: [['horizonDays', 'Započítat pohyby na', 'dnů dopředu']] },
  {
    title: 'Poplatky brokera',
    fields: [
      ['feePct', 'Poplatek z objemu', '%'],
      ['feeMinCzk', 'Nejméně za obchod', 'Kč'],
    ],
  },
  {
    title: 'Daně (ČR)',
    fields: [
      ['taxRateFO', 'Fyzická osoba', '%'],
      ['taxRatePO', 'Právnická osoba', '%'],
      ['timeTestYears', 'Časový test', 'roky'],
      ['smallSalesLimitCzk', 'Osvobozené prodeje do', 'Kč za rok'],
    ],
  },
  {
    title: 'Čekání na osvobození',
    fields: [
      ['waitMaxDays', 'Čekat nejvýše', 'dnů'],
      ['waitMinSavingCzk', 'Když ušetří aspoň', 'Kč'],
    ],
  },
];

export function SettingsDrawer({ settings: s, onChange, onClose, onUpload, onSample, source, sampleUrl }: Props) {
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);

  return (
    <div className="scrim" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-label="Data a pravidla" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>Data a pravidla</h2>
          <button className="btn" onClick={onClose}>
            Zavřít
          </button>
        </div>

        <h3>Data</h3>
        <p className="muted">
          Nyní: <strong>{source}</strong>. Každý měsíc stačí nahrát aktuální Excel ve stejné struktuře jako zadání (ceny, kurzy, pozice, hotovost,
          cash flow, datum ocenění).
        </p>
        <div className="drawer-actions">
          <button className="btn btn-ink" onClick={() => file.current?.click()}>
            Nahrát Excel
          </button>
          <a className="btn" href={sampleUrl} download>
            Stáhnout šablonu
          </a>
          <button className="btn" onClick={onSample}>
            Vrátit ukázková data
          </button>
          <input
            ref={file}
            type="file"
            accept=".xlsx"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = '';
            }}
          />
        </div>

        {GROUPS.map((g) => (
          <fieldset key={g.title}>
            <legend>{g.title}</legend>
            {g.fields.map(([key, name, unit]) => (
              <label key={key} className="field">
                <span>{name}</span>
                <span className="field-input">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={s[key]}
                    onChange={(e) => {
                      const n = e.target.valueAsNumber;
                      if (Number.isFinite(n) && n >= 0) onChange({ ...s, [key]: n });
                    }}
                  />
                  <em>{unit}</em>
                </span>
              </label>
            ))}
          </fieldset>
        ))}
        <fieldset>
          <legend>Obchodování</legend>
          <label className="check">
            <input type="checkbox" checked={s.wholeUnits} onChange={(e) => onChange({ ...s, wholeUnits: e.target.checked })} />
            Jen celé kusy (jinak frakce na 4 desetinná místa)
          </label>
        </fieldset>

        <button className="btn" onClick={() => onChange(DEFAULT_SETTINGS)}>
          Obnovit výchozí pravidla
        </button>
      </aside>
    </div>
  );
}
