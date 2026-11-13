// Contract test a.22 (module a, «Numeri leggibili nel .nsd», 13/11): on saving,
// every number that is not whole is written with at most 6 decimals and no
// trailing zeros (11.399999999999999 → 11.4). For .nsd, user-hoops.json and
// (through the exported function) module e's presets. Reopened, the stitch
// plan is the same: same stitches, same coordinates within 0.001 mm.

import { check, done } from "../core/testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { initSync, StitchEngine } from "../../wasm/pkg/filum_wasm";
import { readProject } from "./read";
import { nsdText } from "./serialize";
import { tidyNumber, tidyStringify } from "./numbers";
import { openUserHoops } from "../hoops/userHoops";
import type { StitchDocument } from "../../types";

const root = path.resolve(process.cwd(), "..");
const enc = new TextEncoder();
/** Numbers written with more than 6 decimals, or in exponent form, in a JSON text. */
const tooLong = (text: string) => text.match(/-?\d+\.\d{7,}|-?\d(\.\d+)?e[-+]?\d+/gi) ?? [];

// the rule, number by number
const cases: [number, number][] = [
  [11.399999999999999, 11.4],
  [0.1 + 0.2, 0.3],
  [2.5, 2.5],
  [-3.0000004, -3],
  [0.1234565, 0.123457],
  [1e-7, 0],
  [0.000001, 0.000001],
  [150, 150],
  [-0.25, -0.25],
  [123456.7891234, 123456.789123],
];
for (const [x, want] of cases) check(Object.is(tidyNumber(x), want) || (want === 0 && tidyNumber(x) === 0), `${x} → ${want} (${tidyNumber(x)})`);
check(tidyStringify({ a: 11.399999999999999, b: [0.1 + 0.2, 7], c: "11.399999999999999" }) === '{"a":11.4,"b":[0.3,7],"c":"11.399999999999999"}', "tidyStringify rounds numbers only, not text");
check(tidyStringify({ x: 1.5 }, 2) === '{\n  "x": 1.5\n}', "tidyStringify indents like JSON.stringify");
check([1, 2.5, 11.399999999999999, 1e-7].every((x) => tidyNumber(tidyNumber(x)) === tidyNumber(x)), "rounding twice changes nothing (a.3: saved again, identical bytes)");

// ---- a.22: an object with a node at 11.399999999999999 is saved as 11.4
const filum = readFileSync(path.join(root, "schema", "examples", "Stemma.filum"), "utf8");
const doc = readProject("Stemma.filum", enc.encode(filum)).doc;
const noisy: StitchDocument = {
  ...doc,
  objects: doc.objects.map((o, i) => (i === 0 ? { ...o, paths: [{ ...o.paths[0], nodes: [{ ...o.paths[0].nodes[0], p: [11.399999999999999, o.paths[0].nodes[0].p[1]] }, ...o.paths[0].nodes.slice(1)] }, ...o.paths.slice(1)] } : o)),
};
const text = nsdText(noisy);
const saved = JSON.parse(text) as StitchDocument;
check(saved.objects[0].paths[0].nodes[0].p[0] === 11.4 && text.includes("11.4,") && !text.includes("11.399999999999999"), "a.22 the node 11.399999999999999 is saved as 11.4");
check(tooLong(filum).length > 0, `(the sample as Filum saves it has long numbers: ${tooLong(filum).slice(0, 3).join(", ")} …)`);
check(tooLong(text).length === 0, `a.22 no number of the .nsd has more than 6 decimals (${tooLong(text).slice(0, 5).join(", ") || "none"})`);
check(nsdText(readProject("Stemma.nsd", enc.encode(text)).doc) === text, "a.3 still: reopened and saved again, identical text");

// ---- a.22: reopened, the stitch plan is the same (same stitches, coordinates within 0.001 mm)
initSync({ module: readFileSync(path.join(process.cwd(), "src", "wasm", "pkg", "filum_wasm_bg.wasm")) });
const engine = new StitchEngine();
type Plan = { coords: Float32Array; flags: Uint8Array; objects: Uint32Array };
const plan = (d: StitchDocument) => engine.plan(JSON.stringify(d)) as Plan;
const before = plan(noisy);
const after = plan(readProject("Stemma.nsd", enc.encode(text)).doc);
check(before.coords.length > 1000, `the sample has a real plan (${before.coords.length / 2} stitches)`);
check(before.coords.length === after.coords.length, `a.22 same number of stitches (${before.coords.length / 2} / ${after.coords.length / 2})`);
let worst = 0;
for (let i = 0; i < Math.min(before.coords.length, after.coords.length); i++) worst = Math.max(worst, Math.abs(before.coords[i] - after.coords[i]));
check(worst <= 0.001, `a.22 every coordinate within 0.001 mm (largest difference ${worst.toFixed(6)} mm)`);
check(before.flags.length === after.flags.length && before.flags.every((f, i) => f === after.flags[i]), "a.22 same jumps, trims, stops and colour changes");
check(before.objects.every((o, i) => o === after.objects[i]), "a.22 every stitch belongs to the same object");

// ---- user-hoops.json too
(async () => {
  const files: Record<string, string> = {};
  const store = { read: async (n: string) => files[n] ?? null, write: async (n: string, t: string) => void (files[n] = t), rename: async (a: string, b: string) => void ((files[b] = files[a]), delete files[a]) };
  const hoops = await openUserHoops(store);
  await hoops.add({ name: "Mio", width: 0.1 + 0.2 + 150, height: 249.99999999999997, shape: "rect", kind: "flat" });
  const json = files["user-hoops.json"];
  check(tooLong(json).length === 0 && /"width": 150\.3,/.test(json) && /"height": 250\b/.test(json), `user-hoops.json: numbers with at most 6 decimals (${json.match(/"(width|height)": [^,\n]+/g)?.join(" ")})`);
  done("module a, readable numbers (a.22)");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
