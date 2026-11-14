// Práce s daty jako s ISO řetězci (YYYY-MM-DD), vždy v UTC – žádné posuny časových pásem.

const parse = (iso: string) => new Date(iso + 'T00:00:00Z');
export const toISO = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (iso: string, n: number) => toISO(new Date(parse(iso).getTime() + n * 86_400_000));

export const addYears = (iso: string, n: number) => {
  const d = parse(iso);
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return toISO(d);
};

/** Počet dní od a do b (kladné, když je b později). */
export const diffDays = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
