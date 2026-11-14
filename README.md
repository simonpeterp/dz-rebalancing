# Rebalancování klientských portfolií

Řešení case study pro Dvořák & Zedník Wealth Management. Webová aplikace, která pro každého klienta ukáže odchylku od cílového portfolia, rozhodne, jestli zasáhnout, navrhne konkrétní obchody a spočítá poplatky a daň podle českých pravidel.

- **Aplikace online:** https://dz-rebalancing.vercel.app
- **Popis pravidel a předpokladů (1 strana):** [docs/POPIS.md](docs/POPIS.md)
- **Výstup pro přiložená data:** [docs/VYSTUP.md](docs/VYSTUP.md)

## Spuštění

```bash
npm install
npm run dev      # aplikace na http://localhost:5173
npm test         # testy výpočetního jádra na přiložených datech
npm run report   # znovu vygeneruje docs/VYSTUP.md
npm run build    # produkční build do dist/
```

Potřebujete Node 20 nebo novější.

## Struktura

```
zadani/      původní zadání (PDF) a data (Excel), beze změn
engine/      výpočetní jádro: čistý TypeScript, žádná závislost na UI ani na Excelu
  types.ts       datový model a parametry pravidel
  settings.ts    výchozí hodnoty pravidel
  valuation.ts   ocenění, váhy, odchylky, toleranční pásma
  tax.ts         české daně: časový test, limit 100 000 Kč, FO a PO
  plan.ts        návrh obchodů, výběr daňových pozic, varianta „počkat“
  engine.test.ts testy s ručně ověřenými čísly
adapters/    napojení jádra na okolí
  excel.ts       načtení Excelu ve formátu zadání
  cs.ts          české texty a formátování čísel
  csv.ts         export pokynů
app/         webové rozhraní (React), jen zobrazuje výsledky jádra
scripts/     report.ts: generuje docs/VYSTUP.md ze stejného jádra
docs/        popis a výstup
public/      ukázková data, která aplikace načte po otevření
```

## Použití v jiném systému

Jádro má jednu vstupní funkci a nepotřebuje prohlížeč:

```ts
import { DEFAULT_SETTINGS, recommend } from './engine';

const { plan, nowPlan, waitPlan, taxSavedByWaitingCzk } = recommend(dataset, 'Klient E', DEFAULT_SETTINGS);
```

`dataset` je obyčejný objekt (typ `Dataset` v `engine/types.ts`). Odkud přijde, je jádru jedno: z Excelu, z databáze nebo z API brokera.

## Měsíční použití

V aplikaci otevřete **Data a pravidla**, stáhněte šablonu, aktualizujte ceny, kurzy, pozice, hotovost a datum ocenění a soubor nahrajte. Data zůstávají v prohlížeči, nikam se neodesílají.
