# Výstup pro přiložená data

Ocenění k 23. 10. 2026. Výchozí pravidla (viz POPIS.md). Soubor generuje `npm run report` ze stejného jádra, které používá aplikace.

| Klient | Majetek | Největší odchylka | Doporučení | Obrat | Poplatky | Daň |
|---|---:|---|---|---:|---:|---:|
| Klient A | 10 267 798 Kč | VWCE +10,8 p. b. | **Rebalancovat** | 2 192 567 Kč | 2 193 Kč | 0 Kč |
| Klient B | 19 859 317 Kč | Hotovost −1,3 p. b. | **Připravit hotovost** | 1 920 586 Kč | 1 921 Kč | 0 Kč |
| Klient C | 6 035 922 Kč | Hotovost +0,3 p. b. | **Bez zásahu** | 0 Kč | 0 Kč | 0 Kč |
| Klient D | 10 560 542 Kč | Hotovost +42,6 p. b. | **Investovat hotovost** | 4 500 000 Kč | 4 500 Kč | 0 Kč |
| Klient E | 22 100 414 Kč | VWCE +12,0 p. b. | **Počkat s prodejem** | 5 345 667 Kč | 5 346 Kč | 0 Kč |

## Klient A: Rebalancovat

Růstový, investiční horizont 15+ let · fyzická osoba · V listopadu plánuje dovklad.

**Proč:**

- Do 21. 1. 2027 (horizont 90 dnů) jsou naplánované vklady 600 000 Kč. Cílové váhy se počítají z majetku po těchto pohybech: 10 867 798 Kč.
- Volná hotovost 690 375 Kč jde do podvážených aktiv v poměru jejich podvážení.
- Ani po využití cash flow není v pásmu: VWCE +6,9 p. b. (pásmo ±5,0 p. b.) a EUNA −5,7 p. b. (pásmo ±5,0 p. b.). Proto se portfolio dorovnává na cílové váhy.
- Všechny prodávané kusy jsou v den prodeje držené déle než 3 roky (osvobozený zisk 265 651 Kč), daň je 0 Kč.
- Rozložení v čase se nedoporučuje: čistý nákup z hotovosti je jen 6,4 % portfolia, méně než hranice 20 %.

| Aktivum | Hodnota | Váha | Cíl | Odchylka | Pásmo | Po zásahu |
|---|---:|---:|---:|---:|---:|---:|
| VWCE | 7 271 775 Kč | 70,8 % | 60,0 % | +10,8 p. b. ⚠ | ±5,0 p. b. | 60,0 % |
| AVWS | 1 928 934 Kč | 18,8 % | 20,0 % | −1,2 p. b. | ±5,0 p. b. | 20,0 % |
| EUNA | 976 714 Kč | 9,5 % | 20,0 % | −10,5 p. b. ⚠ | ±5,0 p. b. | 20,0 % |
| Hotovost | 90 375 Kč | 0,9 % | 0,0 % | +0,9 p. b. | ±1,0 p. b. | 0,0 % |

| Kdy | Akce | Ticker | Kusy | Částka | V měně | Z nákupů |
|---|---|---|---:|---:|---:|---|
| hned | Prodej | VWCE | 216,9074 | 751 096 Kč | 30 909,30 EUR | 15. 3. 2021: 216,9074 ks, osvobozeno |
| hned | Nákup | AVWS | 466,3999 | 142 802 Kč | 5 876,64 EUR |  |
| hned | Nákup | EUNA | 6 223,3337 | 698 669 Kč | 28 751,80 EUR |  |
| 10. 11. 2026 | Nákup | AVWS | 332,5603 | 101 823 Kč | 4 190,26 EUR |  |
| 10. 11. 2026 | Nákup | EUNA | 4 437,4669 | 498 177 Kč | 20 501,10 EUR |  |

Obrat 2 192 567 Kč · poplatky 2 193 Kč · daň 0 Kč · náklady celkem 2 193 Kč (0,0 % majetku).

**Varianty provedení** (scénář: trh se po první části posune o 10 %, rozdíl proti „všechno hned“):

| Varianta | Hotovo | Obchodních dnů | Pokynů | Poplatky | Daň | Trh −10 % | Trh +10 % |
|---|---|---:|---:|---:|---:|---:|---:|
| Všechno hned **(doporučeno)** | 10. 11. 2026 | 2 | 5 | 2 193 Kč | 0 Kč | 0 Kč | 0 Kč |
| Rozložit do 3 částí | 22. 12. 2026 | 4 | 11 | 2 219 Kč | 0 Kč | 0 Kč | 0 Kč |

## Klient B: Připravit hotovost

Rentiér, žije z portfolia · fyzická osoba · Pravidelná měsíční renta a v lednu jednorázový výběr na bydlení pro dceru.

**Proč:**

- Do 21. 1. 2027 (horizont 90 dnů) jsou naplánované výběry 1 755 000 Kč. Cílové váhy se počítají z majetku po těchto pohybech: 18 104 317 Kč.
- Po výběrech chybí 1 920 586 Kč hotovosti (včetně doplnění rezervy na cílových 5,0 %). Prodává se jen z aktiv nad cílovou vahou, takže výběr zároveň vrací portfolio k cíli.
- Po těchto obchodech je vše v tolerančním pásmu, další prodej není potřeba.
- Všechny prodávané kusy jsou v den prodeje držené déle než 3 roky (osvobozený zisk 577 376 Kč), daň je 0 Kč.
- Rozložení v čase se nedoporučuje: do trhu se nepřidává nová hotovost a odklad by jen držel portfolio déle mimo cíl.
- Za horizontem, zatím nezapočteno: výběr 85 000 Kč 1. 2. 2027, výběr 85 000 Kč 1. 3. 2027 a výběr 85 000 Kč 1. 4. 2027.

| Aktivum | Hodnota | Váha | Cíl | Odchylka | Pásmo | Po zásahu |
|---|---:|---:|---:|---:|---:|---:|
| VWCE | 7 618 050 Kč | 38,4 % | 35,0 % | +3,4 p. b. | ±5,0 p. b. | 35,0 % |
| AVWS | 1 775 844 Kč | 8,9 % | 10,0 % | −1,1 p. b. | ±2,5 p. b. | 9,8 % |
| EUNA | 7 914 753 Kč | 39,9 % | 40,0 % | −0,1 p. b. | ±5,0 p. b. | 40,2 % |
| IGLN | 1 811 040 Kč | 9,1 % | 10,0 % | −0,9 p. b. | ±2,5 p. b. | 10,0 % |
| Hotovost | 739 630 Kč | 3,7 % | 5,0 % | −1,3 p. b. ⚠ | ±1,0 p. b. | 5,0 % |

| Kdy | Akce | Ticker | Kusy | Částka | V měně | Z nákupů |
|---|---|---|---:|---:|---:|---|
| hned | Prodej | VWCE | 370,0929 | 1 281 539 Kč | 52 738,24 EUR | 2. 9. 2019: 370,0929 ks, osvobozeno |
| hned | Prodej | EUNA | 5 692,2546 | 639 047 Kč | 26 298,22 EUR | 10. 2. 2021: 5 692,2546 ks, osvobozeno |

Obrat 1 920 586 Kč · poplatky 1 921 Kč · daň 0 Kč · náklady celkem 1 921 Kč (0,0 % majetku).

**Varianty provedení** (scénář: trh se po první části posune o 10 %, rozdíl proti „všechno hned“):

| Varianta | Hotovo | Obchodních dnů | Pokynů | Poplatky | Daň | Trh −10 % | Trh +10 % |
|---|---|---:|---:|---:|---:|---:|---:|
| Všechno hned **(doporučeno)** | 23. 10. 2026 | 1 | 2 | 1 921 Kč | 0 Kč | 0 Kč | 0 Kč |
| Rozložit do 3 částí | 22. 12. 2026 | 3 | 6 | 1 921 Kč | 0 Kč | −128 039 Kč | +128 039 Kč |

## Klient C: Bez zásahu

Vyvážený, bez plánovaných pohybů · fyzická osoba · Klient se ptá, jestli je potřeba něco dělat.

**Proč:**

- Největší odchylka je Hotovost +0,3 p. b. při pásmu ±1,0 p. b.. Nic není mimo toleranci, obchod by jen stál poplatky.

| Aktivum | Hodnota | Váha | Cíl | Odchylka | Pásmo | Po zásahu |
|---|---:|---:|---:|---:|---:|---:|
| VWCE | 3 047 220 Kč | 50,5 % | 50,0 % | +0,5 p. b. | ±5,0 p. b. | 50,5 % |
| AVWS | 581 742 Kč | 9,6 % | 10,0 % | −0,4 p. b. | ±2,5 p. b. | 9,6 % |
| EUNA | 1 796 256 Kč | 29,8 % | 30,0 % | −0,2 p. b. | ±5,0 p. b. | 29,8 % |
| IGLN | 592 704 Kč | 9,8 % | 10,0 % | −0,2 p. b. | ±2,5 p. b. | 9,8 % |
| Hotovost | 18 000 Kč | 0,3 % | 0,0 % | +0,3 p. b. | ±1,0 p. b. | 0,3 % |

Žádné obchody.

## Klient D: Investovat hotovost

Firemní rezerva, horizont 10 let · s.r.o. · Firma 20. 10. 2026 převedla volné prostředky na účet. V únoru plánuje další převod.

**Proč:**

- Volná hotovost 4 500 000 Kč jde do podvážených aktiv v poměru jejich podvážení.
- Po těchto obchodech je vše v tolerančním pásmu, další prodej není potřeba.
- Jen nákupy, žádný prodej: u s.r.o. by se každý prodej se ziskem danil 21 %.
- Čistý nákup z hotovosti je 42,6 % portfolia, víc než hranice 20 %. Koupit všechno v jeden den by byla sázka na jediný kurz, proto je zásah rozložen do 3 částí po 30 dnech, poslední 22. 12. 2026.
- Co rozložení obnáší: kdyby trh po první části klesl o 10 %, vyjde o 300 000 Kč lépe než všechno hned; kdyby o 10 % vzrostl, o 300 000 Kč hůř. Do 22. 12. 2026 zůstává část portfolia mimo cílové váhy.
- Co mluví proti: v průměru vychází nákup najednou lépe, protože peníze jsou na trhu dřív. Rozložení je pojistka proti špatnému načasování, ne cesta k vyššímu výnosu.
- Při dalším nahrání dat se plán počítá znovu ze stavu účtu. Rozpracované části proto provádějte podle staženého CSV.
- Za horizontem, zatím nezapočteno: vklad 3 000 000 Kč 15. 2. 2027.

| Aktivum | Hodnota | Váha | Cíl | Odchylka | Pásmo | Po zásahu |
|---|---:|---:|---:|---:|---:|---:|
| VWCE | 3 289 613 Kč | 31,2 % | 55,0 % | −23,8 p. b. ⚠ | ±5,0 p. b. | 55,0 % |
| AVWS | 918 540 Kč | 8,7 % | 15,0 % | −6,3 p. b. ⚠ | ±3,8 p. b. | 15,0 % |
| EUNA | 1 852 389 Kč | 17,5 % | 30,0 % | −12,5 p. b. ⚠ | ±5,0 p. b. | 30,0 % |
| Hotovost | 4 500 000 Kč | 42,6 % | 0,0 % | +42,6 p. b. ⚠ | ±1,0 p. b. | 0,0 % |

| Kdy | Akce | Ticker | Kusy | Částka | V měně | Z nákupů |
|---|---|---|---:|---:|---:|---|
| hned | Nákup | VWCE | 242,4552 | 839 562 Kč | 34 549,87 EUR |  |
| hned | Nákup | AVWS | 724,5642 | 221 847 Kč | 9 129,51 EUR |  |
| hned | Nákup | EUNA | 3 906,714 | 438 591 Kč | 18 049,02 EUR |  |
| 22. 11. 2026 | Nákup | VWCE | 242,4552 | 839 562 Kč | 34 549,87 EUR |  |
| 22. 11. 2026 | Nákup | AVWS | 724,5642 | 221 847 Kč | 9 129,51 EUR |  |
| 22. 11. 2026 | Nákup | EUNA | 3 906,714 | 438 591 Kč | 18 049,02 EUR |  |
| 22. 12. 2026 | Nákup | VWCE | 242,4552 | 839 562 Kč | 34 549,87 EUR |  |
| 22. 12. 2026 | Nákup | AVWS | 724,5642 | 221 847 Kč | 9 129,51 EUR |  |
| 22. 12. 2026 | Nákup | EUNA | 3 906,714 | 438 591 Kč | 18 049,02 EUR |  |

Obrat 4 500 000 Kč · poplatky 4 500 Kč · daň 0 Kč · náklady celkem 4 500 Kč (0,0 % majetku).

**Varianty provedení** (scénář: trh se po první části posune o 10 %, rozdíl proti „všechno hned“):

| Varianta | Hotovo | Obchodních dnů | Pokynů | Poplatky | Daň | Trh −10 % | Trh +10 % |
|---|---|---:|---:|---:|---:|---:|---:|
| Všechno hned | 23. 10. 2026 | 1 | 3 | 4 500 Kč | 0 Kč | 0 Kč | 0 Kč |
| Rozložit do 3 částí **(doporučeno)** | 22. 12. 2026 | 3 | 9 | 4 500 Kč | 0 Kč | +300 000 Kč | −300 000 Kč |

## Klient E: Počkat s prodejem

Růstově vyvážený · fyzická osoba · Dlouholetý klient, část pozic nakoupena před přechodem k D&Z.

**Proč:**

- Do 21. 1. 2027 (horizont 90 dnů) jsou naplánované výběry 250 000 Kč. Cílové váhy se počítají z majetku po těchto pohybech: 21 850 414 Kč.
- Po výběrech chybí 197 780 Kč hotovosti. Prodává se jen z aktiv nad cílovou vahou, takže výběr zároveň vrací portfolio k cíli.
- Ani po využití cash flow není v pásmu: VWCE +11,8 p. b. (pásmo ±5,0 p. b.) a EUNA −9,4 p. b. (pásmo ±5,0 p. b.). Proto se portfolio dorovnává na cílové váhy.
- Všechny prodávané kusy jsou v den prodeje držené déle než 3 roky (osvobozený zisk 923 237 Kč), daň je 0 Kč.
- Počkat se vyplatí: 620,44 ks VWCE z nákupu 20. 11. 2023 splní časový test 21. 11. 2026. Prodej hned by stál na dani 80 953 Kč, po tomto datu 0 Kč. Osvobozené kusy se prodávají dřív. Vyplatí se to, dokud VWCE do té doby neztratí víc než 3,8 % proti nakupovaným aktivům.
- Rozložení v čase se nedoporučuje: do trhu se nepřidává nová hotovost a odklad by jen držel portfolio déle mimo cíl.

| Aktivum | Hodnota | Váha | Cíl | Odchylka | Pásmo | Po zásahu |
|---|---:|---:|---:|---:|---:|---:|
| VWCE | 12 604 410 Kč | 57,0 % | 45,0 % | +12,0 p. b. ⚠ | ±5,0 p. b. | 45,0 % |
| AVWS | 3 306 744 Kč | 15,0 % | 15,0 % | 0,0 p. b. | ±3,8 p. b. | 15,1 % |
| EUNA | 4 490 640 Kč | 20,3 % | 30,0 % | −9,7 p. b. ⚠ | ±5,0 p. b. | 29,9 % |
| IGLN | 1 646 400 Kč | 7,4 % | 10,0 % | −2,6 p. b. ⚠ | ±2,5 p. b. | 10,0 % |
| Hotovost | 52 220 Kč | 0,2 % | 0,0 % | +0,2 p. b. | ±1,0 p. b. | 0,0 % |

| Kdy | Akce | Ticker | Kusy | Částka | V měně | Z nákupů |
|---|---|---|---:|---:|---:|---|
| hned | Prodej | VWCE | 180 | 623 295 Kč | 25 650,00 EUR | 13. 1. 2020: 180 ks, osvobozeno |
| hned | Nákup | EUNA | 4 772,0303 | 535 737 Kč | 22 046,78 EUR |  |
| hned | Nákup | IGLN | 84,8993 | 139 778 Kč | 6 656,11 USD |  |
| 21. 11. 2026 | Prodej | VWCE | 620,44 | 2 148 429 Kč | 88 412,70 EUR | 20. 11. 2023: 620,44 ks, osvobozeno |
| 21. 11. 2026 | Nákup | EUNA | 13 411,0401 | 1 505 604 Kč | 61 959,01 EUR |  |
| 21. 11. 2026 | Nákup | IGLN | 238,5962 | 392 825 Kč | 18 705,94 USD |  |

Obrat 5 345 667 Kč · poplatky 5 346 Kč · daň 0 Kč · náklady celkem 5 346 Kč (0,0 % majetku).

**Varianty provedení** (scénář: trh se po první části posune o 10 %, rozdíl proti „všechno hned“):

| Varianta | Hotovo | Obchodních dnů | Pokynů | Poplatky | Daň | Trh −10 % | Trh +10 % |
|---|---|---:|---:|---:|---:|---:|---:|
| Všechno hned | 23. 10. 2026 | 1 | 3 | 5 346 Kč | 80 953 Kč | 0 Kč | 0 Kč |
| Počkat do 21. 11. 2026 **(doporučeno)** | 21. 11. 2026 | 2 | 6 | 5 346 Kč | 0 Kč | −25 000 Kč | +25 000 Kč |
| Rozložit do 3 částí | 22. 12. 2026 | 3 | 9 | 5 346 Kč | 0 Kč | −25 000 Kč | +25 000 Kč |
