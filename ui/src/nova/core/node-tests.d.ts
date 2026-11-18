// The few Node APIs the NOVAstitch tests use (they run in Node: npm run test:match).
// Declared here instead of @types/node, which would change timer types in all of Filum.

declare module "node:fs" {
  /** Node's Buffer, as far as the tests use it (binary files: icons). */
  export interface Buffer extends Uint8Array {
    equals(other: Uint8Array): boolean;
    readUInt16LE(offset: number): number;
    readUInt32LE(offset: number): number;
    readUInt32BE(offset: number): number;
    subarray(start?: number, end?: number): Buffer;
    toString(encoding?: string): string;
  }
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function readFileSync(path: string): Buffer;
  export function writeFileSync(path: string, data: string): void;
  export function renameSync(from: string, to: string): void;
  export function rmSync(path: string, opts?: { force?: boolean; recursive?: boolean }): void;
  export function existsSync(path: string): boolean;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { isDirectory(): boolean };
  export function mkdtempSync(prefix: string): string;
}
declare module "node:os" {
  export function tmpdir(): string;
}
declare module "node:path" {
  const path: {
    join(...parts: string[]): string;
    resolve(...parts: string[]): string;
    basename(p: string): string;
    relative(from: string, to: string): string;
    sep: string;
  };
  export default path;
}
declare const process: { cwd(): string; exit(code?: number): never; argv: string[] };
