// Boční panel s pravidly. Je stále vidět vedle výsledků, takže každá změna čísla
// se hned projeví v přehledu i v detailu klienta.

import { useEffect, useRef, useState } from 'react';
import { day } from '../../adapters/cs';
import { DEFAULT_SETTINGS, type Settings } from '../../engine';
import { GROUPS, type Field } from './rules';

interface Props {
  settings: Settings;
  baseline: Settings;
  onChange: (s: Settings) => void;
  onUpload: (f: File) => void;
  onSample: () => void;
  source: string;
  asOf: string | null;
  sampleUrl: string;
}

const show = (x: number) => String(x).replace('.', ',');

/** Číselné pole, které dovolí rozepsanou hodnotu („0,“) a ven posílá jen platná čísla. */
function NumField({ field, value, base, onChange }: { field: Field; value: number; base: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  const parse = (t: string) => Number(t.replace(/\s/g, '').replace(',', '.'));
  useEffect(() => {
    if (parse(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const changed = value !== base;
  return (
    <label className={`rule ${changed ? 'rule-changed' : ''}`}>
      <span className="rule-name">
        {field.name}
        <small>{changed ? `${field.unit} · bylo ${show(base)}` : field.unit}</small>
      </span>
      <input
        type="number"
        min={0}
        step={field.step}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = parse(e.target.value);
          if (e.target.value !== '' && Number.isFinite(n) && n >= 0) onChange(n);
        }}
        onBlur={() => setText(String(value))}
      />
    </label>
  );
}

export function RulesPanel({ settings: s, baseline, onChange, onUpload, onSample, source, asOf, sampleUrl }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const isDefault = JSON.stringify(s) === JSON.stringify(DEFAULT_SETTINGS);

  return (
    <div className="rules-panel">
      <h2>Pravidla</h2>
      <p className="muted">Změna se hned přepočítá. Dole se ukáže, co se proti výchozímu stavu posunulo.</p>

      {GROUPS.map((g) => (
        <fieldset key={g.title}>
          <legend>{g.title}</legend>
          <p className="rule-hint">{g.hint}</p>
          {g.fields.map((f) => (
            <NumField key={f.key} field={f} value={s[f.key]} base={baseline[f.key]} onChange={(n) => onChange({ ...s, [f.key]: n })} />
          ))}
        </fieldset>
      ))}
      <fieldset>
        <legend>Obchodování</legend>
        <label className="check">
          <input type="checkbox" checked={s.wholeUnits} onChange={(e) => onChange({ ...s, wholeUnits: e.target.checked })} />
          Jen celé kusy (jinak zlomky na 4 desetinná místa)
        </label>
      </fieldset>
      <button className="btn btn-block" onClick={() => onChange(DEFAULT_SETTINGS)} disabled={isDefault}>
        Obnovit výchozí pravidla
      </button>

      <fieldset className="rules-data">
        <legend>Data</legend>
        <p className="rule-hint">
          <strong>{source}</strong>
          {asOf && <> · ocenění k {day(asOf)}</>}. Každý měsíc stačí nahrát aktuální Excel ve stejné struktuře.
        </p>
        <div className="rules-actions">
          <button className="btn btn-ink" onClick={() => file.current?.click()}>
            Nahrát Excel
          </button>
          <a className="btn" href={sampleUrl} download>
            Šablona
          </a>
          <button className="btn" onClick={onSample}>
            Ukázková data
          </button>
        </div>
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
      </fieldset>
    </div>
  );
}
