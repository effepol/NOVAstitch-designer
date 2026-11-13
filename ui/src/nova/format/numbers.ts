// Readable numbers (contract, module a, 13/11): on saving, every number that is
// not whole is written with at most 6 decimals and no trailing zeros
// (11.399999999999999 → 11.4). Six decimals take away the noise of the
// computations without losing anything, relative values from 0 to 1 included.
// Used for .nsd and user-hoops.json; module e uses it for its presets.

/** A number with at most 6 decimals: whole numbers as they are, the others rounded (correctly, from their exact value). */
export function tidyNumber(x: number): number {
  if (Number.isInteger(x) || !Number.isFinite(x)) return x;
  const r = Number(x.toFixed(6));
  // -0 is written as 0 anyway; keep it a plain 0
  return r === 0 ? 0 : r;
}

/** JSON.stringify with every number through tidyNumber (texts untouched). */
export function tidyStringify(value: unknown, indent?: number): string {
  return JSON.stringify(value, (_key, v) => (typeof v === "number" ? tidyNumber(v) : v), indent);
}
