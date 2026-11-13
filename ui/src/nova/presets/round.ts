// Readable numbers (contract, module a, 13/11): at most 6 decimals, trailing
// zeros dropped (11.399999999999999 → 11.4). Module a owns the rule; this is
// module e's copy until module a exports its function from nova/format.

export const round6 = (v: number): number => (Number.isFinite(v) && !Number.isInteger(v) ? +v.toFixed(6) + 0 : v);
