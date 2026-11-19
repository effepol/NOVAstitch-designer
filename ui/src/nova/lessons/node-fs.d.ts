// The Node APIs module g's tests use, beside module 0's declarations (core/node-tests.d.ts).

declare module "node:fs" {
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void;
  export function readdirSync(path: string, opts: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
}
