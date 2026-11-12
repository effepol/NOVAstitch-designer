// Run the UI logic checks (src/lib/*.test.ts) in Node: thread matching, node operations.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const lib = path.resolve(here, "../src/lib");
// NOVAstitch: the modules' tests live under src/nova (any depth)
const nova = path.resolve(here, "../src/nova");
const novaTests = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? novaTests(path.join(dir, e.name)) : e.name.endsWith(".test.ts") ? [path.join(dir, e.name)] : [],
  );
const tests = [
  ...readdirSync(lib).filter((x) => x.endsWith(".test.ts")).map((f) => path.join(lib, f)),
  ...(existsSync(nova) ? novaTests(nova) : []),
];
// optional filter: node scripts/test-match.mjs nova/core
const only = process.argv[2];
const dir = mkdtempSync(path.join(tmpdir(), "filum-test-"));
for (const file of tests.filter((f) => !only || f.includes(only))) {
  const f = path.relative(path.resolve(here, "../src"), file);
  const out = path.join(dir, f.replace(/[\\/]/g, "_").replace(/\.ts$/, ".cjs"));
  // import.meta.url: the engine client builds its worker URL from it when the store loads
  await build({ entryPoints: [file], bundle: true, platform: "node", format: "cjs", outfile: out, logLevel: "error", define: { "import.meta.url": JSON.stringify("file:///") } });
  console.log(`— ${f}`);
  execFileSync(process.execPath, [out], { stdio: "inherit" });
}
