# Nástroj pro rebalancování: pravidla, předpoklady, omezení

Webová aplikace, která z Excelu ve formátu zadání spočítá pro každého klienta stav portfolia, řekne, jestli zasáhnout, navrhne obchody po jednotlivých nákupech a ukáže, kolik zásah stojí. Přehled shrnuje všechny klienty a řadí jejich akce do jednoho kalendáře. Výpočty jsou v samostatném jádru (`engine/`, čistý TypeScript) pokrytém testy na přiložených datech.

## Pravidla a proč

1. **Toleranční pásmo 5/25.** Zasahuje se, až když se aktivum odchýlí o víc než 5 p. b., nebo o víc než 25 % své cílové váhy (platí užší hranice). Hotovost má pásmo ±1 p. b.
2. **Cash flow nejdřív.** Vklady a výběry v příštích 90 dnech se započtou předem: vklad jde do podvážených aktiv, na výběr se prodávají jen nadvážená. Tyto obchody by proběhly tak jako tak, takže vracejí portfolio k cíli zadarmo.
3. **Teprve potom kontrola pásma.** Je-li i po cash flow něco mimo pásmo, dorovná se portfolio na cílové váhy. Obchody pod 0,5 % portfolia se vynechávají.
4. **Daňově nejlevnější kusy napřed.** Každý nákup je samostatná daňová pozice. Pořadí prodeje: zdanitelná ztráta, osvobozené kusy, zdanitelné od nejmenšího zisku.
5. **Počkat, když se to vyplatí.** Osvobodí-li se pozice do 90 dnů a ušetří to aspoň 10 000 Kč, prodej se odloží na první osvobozený den. Aplikace ukáže, o kolik smí aktivum mezitím zlevnit, než úsporu smaže.
6. **Velký nákup rozložit.** Přesáhne-li čistý nákup z hotovosti 20 % portfolia, doporučí se rozdělit ho do 3 částí po 30 dnech, aby vstup do trhu nestál na kurzu jediného dne. Je to pojistka, ne cesta k výnosu: v průměru vychází nákup najednou lépe, proto je hranice nastavitelná. Výměna jednoho aktiva za druhé se nerozkládá, odklad by jen držel portfolio mimo cíl.

Varianty provedení (hned, počkat, rozložit) jsou u klienta vedle sebe s daní, poplatky a datem dokončení. Scénář „trh se po první části posune o ±10 %“ říká v korunách, co rozložení přinese nebo bude stát; pravděpodobnosti nástroj neodhaduje. Všechny hodnoty jsou nastavitelné a každá změna se zvýrazní proti výchozímu stavu.

## Daně a poplatky

- **Fyzická osoba:** 15 % ze zisku; osvobozeno, pokud doba držení přesáhne 3 roky (od dne po třetím výročí), nebo pokud prodeje za rok nepřesáhnou 100 000 Kč. Zdanitelné ztráty se započítávají proti zdanitelným ziskům, osvobozené ne.
- **Právnická osoba:** 21 % vždy, bez časového testu. Proto se u s.r.o. prodává, jen když je to nutné.
- **Poplatek brokera:** 0,1 % z objemu, nejméně 50 Kč za pokyn.

## Předpoklady

- Nákupní cena se pro daň přepočítává dnešním kurzem (zjednodušení povolené v zadání).
- Počítá se s frakčními kusy na 4 desetinná místa (potvrzeno firmou); lze přepnout na celé kusy.
- Pohyby s datem do dne ocenění už jsou v zůstatcích hotovosti. Pozdější obchody i grafy vývoje v čase počítají s dnešními cenami; nástroj trh nepředpovídá.
- Klient nemá v daném roce jiné prodeje cenných papírů ani příjmy, které by posunuly sazbu na 23 %.

## Co nástroj neumí

- Nestahuje ceny ani kurzy, bere je z Excelu. Neodesílá pokyny brokerovi, jen je vyexportuje do CSV.
- Nezná roční limit 40 mil. Kč pro osvobozené příjmy, solidární sazbu 23 %, daňové ztráty PO z minulých let ani náklady na konverzi měn (lze zahrnout do poplatku). Limit 100 000 Kč posuzuje za celý plán, i přes konec roku.
- Scénář hýbe všemi instrumenty stejně.
- Neeviduje historii zásahů ani rozpracované plány. Každý měsíc počítá znovu z nového Excelu; zbylé části rozloženého nákupu se proto provádějí podle exportovaného CSV.

## Změny v datech

Žádné. Aplikace čte přiložený soubor beze změn.
