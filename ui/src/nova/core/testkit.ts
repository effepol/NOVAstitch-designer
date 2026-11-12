// Shared helpers for the NOVAstitch tests (npm run test:match runs them in Node).
// Import this first: the store reads localStorage when it loads.

const mem = new Map<string, string>();
const g = globalThis as unknown as { localStorage?: Storage };
if (!g.localStorage)
  g.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size;
    },
  } as Storage;

// the engine client starts a Web Worker when the store loads; Node has none
const w = globalThis as unknown as { Worker?: unknown };
if (!w.Worker)
  w.Worker = class {
    onmessage: unknown = null;
    onerror: unknown = null;
    postMessage() {}
    addEventListener() {}
    removeEventListener() {}
    terminate() {}
  };

let failed = 0;
export const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${msg}`);
  if (!ok) failed++;
};
export const done = (what: string) => {
  if (failed) throw new Error(`${failed} ${what} check(s) failed`);
};
