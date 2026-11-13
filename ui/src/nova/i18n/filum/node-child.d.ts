// Modulo i: l'API di Node che il test del linter (linter.test.ts) usa per lanciarlo.
// Dichiarata qui come fa nova/core/node-tests.d.ts, senza @types/node.

declare module "node:child_process" {
  export function execFileSync(file: string, args: string[], opts: { encoding: "utf8"; stdio?: "pipe" }): string;
}
