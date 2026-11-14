# Nástroj pro rebalancování: pravidla, předpoklady, omezení

Webová aplikace, která z Excelu ve formátu zadání spočítá pro každého klienta stav portfolia, řekne, jestli zasáhnout, navrhne konkrétní obchody po jednotlivých nákupech a ukáže, kolik zásah stojí. Výpočty jsou v samostatném jádru (`engine/`, čistý TypeScript bez závislostí) a jsou pokryté testy na přiložených datech.

## Pravidla a proč

1. **Toleranční pásmo 5/25.** Zasahuje se, až když se aktivum odchýlí o víc než 5 p. b., nebo o víc než 25 % své cílové váhy (platí užší hranice; zlato s cílem 10 % má tedy pásmo ±2,5 p. b.). Kalendářní rebalancování obchoduje i tehdy, když to není potřeba; pásmo obchoduje jen při skutečné odchylce rizika. Hotovost má pásmo ±1 p. b.
2. **Cash flow nejdřív.** Vklady a výběry v příštích 90 dnech se započtou předem. Vklad jde do podvážených aktiv, na výběr se prodávají jen nadvážená. Tyto obchody by proběhly tak jako tak, takže přibližují portfolio k cíli zadarmo. Peníze potřebné do 90 dnů nemají zůstat v akciích.
3. **Teprve potom kontrola pásma.** Je-li i po cash flow něco mimo pásmo, dorovná se portfolio na cílové váhy. Obchody pod 0,5 % portfolia se vynechávají.
4. **Daňově nejlevnější kusy napřed.** Každý nákup je samostatná daňová pozice. Pořadí prodeje: zdanitelná ztráta, potom osvobozené kusy, zdanitelné až nakonec od nejmenšího zisku.
5. **Počkat, když se to vyplatí.** Pokud se pozice osvobodí do 90 dnů a čekání ušetří aspoň 10 000 Kč na dani, prodej se odloží na první osvobozený den; osvobozené kusy se prodají hned. Aplikace ukáže obě varianty a portfolio manažer může doporučení přepnout.

Všechny hodnoty jsou v aplikaci nastavitelné (Data a pravidla).

## Daně a poplatky

- **Fyzická osoba:** 15 % ze zisku; osvobozeno, pokud doba držení přesáhne 3 roky (první osvobozený den je den po třetím výročí), nebo pokud prodeje za rok nepřesáhnou 100 000 Kč. Zdanitelné ztráty se započítávají proti zdanitelným ziskům, osvobozené ztráty ne.
- **Právnická osoba:** 21 % vždy, bez časového testu. Proto se u s.r.o. prodává, jen když je to nutné.
- **Poplatek brokera:** 0,1 % z objemu, nejméně 50 Kč za obchod (nastavitelné).

## Předpoklady

- Nákupní cena se pro daň přepočítává dnešním kurzem (zjednodušení povolené v zadání).
- Počítá se s frakčními kusy na 4 desetinná místa (potvrzeno firmou); lze přepnout na celé kusy.
- Pohyby s datem do dne ocenění už jsou v zůstatcích hotovosti. Pozdější obchody jsou oceněné dnešními cenami, počty kusů jsou orientační.
- Klient nemá v daném roce jiné prodeje cenných papírů ani příjmy, které by posunuly sazbu na 23 %.

## Co nástroj neumí

- Nestahuje ceny ani kurzy, bere je z Excelu. Neodesílá pokyny brokerovi, jen je vyexportuje do CSV.
- Nezná roční limit 40 mil. Kč pro osvobozené příjmy, solidární sazbu 23 %, daňové ztráty PO z minulých let ani náklady na konverzi měn (lze zahrnout do poplatku).
- Riziko čekání na osvobození nevyčísluje; rozhoduje pevnou hranicí úspory a nechává poslední slovo manažerovi.
- Neeviduje historii zásahů. Každý měsíc se nahraje nový Excel.

## Změny v datech

Žádné. Aplikace čte přiložený soubor beze změn.
