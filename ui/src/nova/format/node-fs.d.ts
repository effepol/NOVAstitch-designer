// The byte-level Node APIs module a's tests use, beside module 0's declarations (core/node-tests.d.ts).

declare module "node:fs" {
  export function readFileSync(path: string): Uint8Array;
  export function writeFileSync(path: string, data: Uint8Array): void;
}
