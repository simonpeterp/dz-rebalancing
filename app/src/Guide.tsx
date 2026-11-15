// Krátký návod: jak stránku číst a co znamenají použité pojmy. Otevírá se tlačítkem v hlavičce.

export function Guide({ onClose }: { onClose: () => void }) {
  return (
    <section className="card guide" aria-label="Jak to číst">
      <div className="card-head">
        <h2>Jak to číst</h2>
        <button className="btn" onClick={onClose}>
          Zavřít
        </button>
      </div>
      <div className="guide-cols">
        <div>
          <h3>Postup</h3>
          <ol>
            <li>
              <strong>Přehled.</strong> Nahoře souhrn za všechny klienty, pod ním tabulka seřazená podle naléhavosti: co u koho udělat a kolik to stojí.
            </li>
            <li>
              <strong>Detail klienta.</strong> Kliknutím na klienta uvidíte doporučení se zdůvodněním, varianty provedení a konkrétní pokyny po dnech. Pokyny stáhnete jako CSV.
            </li>
            <li>
              <strong>Pravidla vlevo.</strong> Změníte číslo a vše se hned přepočítá. Dole se objeví lišta, která řekne, co se tím změnilo, a nabídne srovnání před a po.
            </li>
            <li>
              <strong>Co kdyby.</strong> V detailu klienta lze zkusit vklad nebo výběr; návrh se přepočítá a změny se zvýrazní žlutě.
            </li>
            <li>
              <strong>Každý měsíc.</strong> Dole v panelu pravidel nahrajte aktuální Excel (ceny, kurzy, pozice, hotovost, cash flow, datum ocenění).
            </li>
          </ol>
        </div>
        <div>
          <h3>Pojmy</h3>
          <dl>
            <dt>Den ocenění</dt>
            <dd>Datum, ke kterému jsou v Excelu ceny a zůstatky. Nástroj ho bere jako výchozí bod; „hned“ znamená k tomuto dni.</dd>
            <dt>p. b. (procentní bod)</dt>
            <dd>Rozdíl mezi skutečnou a cílovou vahou. Cíl 60 %, skutečnost 70,8 % je odchylka +10,8 p. b.</dd>
            <dt>Toleranční pásmo</dt>
            <dd>Jak daleko od cíle smí aktivum být, než se zasáhne. Uvnitř pásma se neobchoduje, obchod by jen stál poplatky.</dd>
            <dt>Horizont</dt>
            <dd>Jak daleko dopředu se započítávají plánované vklady a výběry.</dd>
            <dt>Časový test</dt>
            <dd>Fyzická osoba neplatí daň ze zisku, pokud cenný papír držela déle než 3 roky. Proto se někdy vyplatí s prodejem počkat.</dd>
            <dt>Mimo cíl</dt>
            <dd>Část portfolia, která je jinde, než má podle cílových vah být: tolik by se muselo přesunout.</dd>
          </dl>
        </div>
      </div>
    </section>
  );
}
