// Hook test (module 0): the modules start without touching main.tsx. Module 0's
// installBridge (which main.tsx already calls at start) starts every
// ui/src/nova/<module>/install.ts once; opening a file waits for them, so a
// .nsd the app was opened with finds module a's project format.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { modulesReady, startModules } from "./modules";

const src = path.resolve(process.cwd(), "src");
const read = (f: string) => readFileSync(path.join(src, f), "utf8");

(async () => {
  check(!/nova\/core\/modules|startModules/.test(read("main.tsx")), "main.tsx is not touched: it does not name the modules");
  check(/startModules\(\)/.test(read("nova/core/bridge.ts")), "installBridge starts the modules");
  check(/import\.meta\.glob(<\w+>)?\(\s*"\.\.\/\*\/install\.ts"/.test(read("nova/core/modules.ts")), "the modules are found as nova/<module>/install.ts");
  const actions = read("lib/actions.ts");
  const hb = actions.slice(actions.indexOf("async function handleBytes"));
  check(/await modulesReady\(\)/.test(hb.slice(0, hb.indexOf("\n}\n"))), "opening a file (menu, drop, launch) waits for the modules");

  // started once, in name order; one that fails does not stop the others
  const ran: string[] = [];
  let release = () => {};
  const slow = new Promise<void>((r) => (release = r));
  const found = {
    "../b/install.ts": { install: () => void ran.push("b") },
    "../a/install.ts": { install: async () => { await slow; ran.push("a"); } },
    "../c/install.ts": { install: () => { throw new Error("broken module"); } },
    "../d/install.ts": { install: () => void ran.push("d") },
  };
  const p = startModules(found);
  let ready = false;
  void modulesReady().then(() => (ready = true));
  await Promise.resolve();
  check(!ready, "modulesReady waits while a module is starting");
  release();
  await p;
  await modulesReady();
  check(ready && ran.join() === "a,b,d", `every module starts, in order, a failing one is skipped (${ran.join()})`);
  await startModules(found);
  check(ran.join() === "a,b,d", "a second start does nothing");

  done("module start hook");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
