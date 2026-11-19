// Contract tests e.1–e.15 on the real interface, inside npm test: runs
// interfaccia.mjs (Chromium, the engine in WebAssembly, Filum's fabric picker,
// Ctrl+Z, the Issues panel). Like the giro of module i it needs the engine
// built (npm run wasm) and Chromium, and it is left out with NOVA_SALTA_GIRO=1
// (on GitHub the browser tests run in their own step).

import { check, done } from "../core/testkit";
import { execFileSync } from "node:child_process";
import path from "node:path";

const proc = (globalThis as unknown as { process: { env: Record<string, string | undefined>; execPath: string } }).process;

if (proc.env.NOVA_SALTA_GIRO === "1") {
  console.log("—   e.1–e.15 sull'interfaccia: saltato (NOVA_SALTA_GIRO=1)");
} else {
  const script = path.resolve(process.cwd(), "src/nova/presets/interfaccia.mjs");
  let ok = true;
  try {
    console.log(execFileSync(proc.execPath, [script], { encoding: "utf8", stdio: "pipe" }).trimEnd());
  } catch (e) {
    console.log(String((e as { stdout?: string }).stdout ?? e).trimEnd());
    ok = false;
  }
  check(ok, "e.1–e.15 sull'interfaccia vera (interfaccia.mjs)");
}
done("module e on the interface");
