// České daně z prodeje cenných papírů (zákon o daních z příjmů).
//
// FO:  15 % ze zisku. Osvobozeno, pokud doba mezi nákupem a prodejem přesáhne 3 roky (časový test),
//      nebo pokud úhrn příjmů z prodeje CP za rok nepřesáhne 100 000 Kč.
//      Ztrátu z nevyhovujících (zdanitelných) prodejů lze započíst proti ziskům z jiných
//      zdanitelných prodejů CP v témže roce. Ztráta z osvobozeného prodeje se nezapočítává.
// PO:  21 %, bez časového testu. Zisky a ztráty z prodeje se sčítají.

import { addDays, addYears } from './dates';
import type { Settings, TaxRegime } from './types';

export const taxRate = (regime: TaxRegime, s: Settings) => (regime === 'FO' ? s.taxRateFO : s.taxRatePO) / 100;

/**
 * První den, kdy je prodej osvobozen. Zákon říká „doba přesáhne 3 roky“,
 * tedy nejdříve den po třetím výročí nákupu. Pro PO osvobození neexistuje (null).
 */
export function exemptFrom(buyDate: string, regime: TaxRegime, s: Settings): string | null {
  if (regime !== 'FO') return null;
  return addDays(addYears(buyDate, s.timeTestYears), 1);
}

export const isExemptOn = (exemptFromDate: string | null, saleDate: string) =>
  exemptFromDate !== null && exemptFromDate <= saleDate;

export interface SaleForTax {
  proceedsCzk: number;
  gainCzk: number;
  exempt: boolean; // splněn časový test v den prodeje
}

export interface TaxResult {
  taxCzk: number;
  taxableGainCzk: number; // čistý zdanitelný zisk (po započtení ztrát), nejméně 0
  exemptGainCzk: number; // zisk, který se díky časovému testu nedaní
  smallSalesExempt: boolean; // uplatněn limit 100 000 Kč
}

export function taxOnSales(sales: SaleForTax[], regime: TaxRegime, s: Settings): TaxResult {
  const proceeds = sales.reduce((a, x) => a + x.proceedsCzk, 0);
  const exemptGain = sales.filter((x) => x.exempt).reduce((a, x) => a + x.gainCzk, 0);
  const net = sales.filter((x) => !x.exempt).reduce((a, x) => a + x.gainCzk, 0);

  if (regime === 'FO' && proceeds > 0 && proceeds <= s.smallSalesLimitCzk) {
    return { taxCzk: 0, taxableGainCzk: 0, exemptGainCzk: exemptGain + Math.max(0, net), smallSalesExempt: net > 0 };
  }
  const taxable = Math.max(0, net);
  return { taxCzk: taxable * taxRate(regime, s), taxableGainCzk: taxable, exemptGainCzk: exemptGain, smallSalesExempt: false };
}
