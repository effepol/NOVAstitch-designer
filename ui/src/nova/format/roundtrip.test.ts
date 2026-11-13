// Contract tests a.3 and a.4 (module a): a .nsd saved and read back is the same
// document; saved again, the bytes are the same, byte for byte. Unknown fields
// survive open-and-save wherever they are.

import { check, done } from "../core/testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { readProject } from "./read";
import { nsdBytes, nsdText } from "./serialize";
import { APP, novaDefaults } from "./nova";
import type { StitchDocument } from "../../types";

const examples = path.resolve(process.cwd(), "..", "schema", "examples");
const filumBytes = new Uint8Array([...new TextEncoder().encode(readFileSync(path.join(examples, "Stemma.filum"), "utf8"))]);
const equalBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);
const firstDiff = (a: Uint8Array, b: Uint8Array) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return i;
  return -1;
};

// ---- a.3: the .filum opened, saved as .nsd, read back, saved again
{
  const opened = readProject("Stemma.filum", filumBytes).doc;
  const first = nsdBytes(opened);
  const reread = readProject("Stemma.nsd", first);
  check(reread.fromSchema === 1 && !reread.migrated && !reread.readOnly && reread.warnings.length === 0, "a.3 the saved .nsd reads back as current, no migration, no warning");
  check(JSON.stringify(reread.doc) === JSON.stringify({ ...opened, nova: { ...opened.nova, app: APP } }), "a.3 the document read back is identical (only nova.app, the writer, is added)");
  const second = nsdBytes(reread.doc);
  check(equalBytes(first, second), `a.3 saved again: identical bytes (${first.length} / ${second.length}, first difference at ${firstDiff(first, second)})`);
  // and again, through a third generation
  const third = nsdBytes(readProject("Stemma.nsd", second).doc);
  check(equalBytes(second, third), "a.3 a third save: still identical bytes");
  // saving does not change the document in memory
  const snapshot = JSON.stringify(opened);
  nsdBytes(opened);
  check(JSON.stringify(opened) === snapshot, "a.3 saving leaves the document in memory as it was");
}

// numbers: at most 6 decimals (a.22, 13/11), then stable; text comes back exactly
{
  const d = readProject("N.filum", filumBytes).doc;
  const odd = { ...d, hoop: { ...d.hoop, width: 0.1 + 0.2, height: 1e-7 }, name: "Ünïcödé ✂ «Stemma»  " } as StitchDocument;
  const back = readProject("N.nsd", nsdBytes(odd)).doc;
  check(back.hoop.width === 0.3 && back.hoop.height === 0 && back.name === odd.name, "a.3 numbers come back with at most 6 decimals (a.22), text exactly");
  check(equalBytes(nsdBytes(back), nsdBytes(readProject("N.nsd", nsdBytes(back)).doc)), "a.3 …and their bytes are stable");
}

// readable JSON: indented, UTF-8, one line end at the end, no compression
{
  const text = nsdText(readProject("Stemma.filum", filumBytes).doc);
  check(text.startsWith("{\n  \"") && text.endsWith("}\n") && !text.includes("\r"), "the .nsd is indented JSON with \\n line ends");
  check(JSON.parse(text).version === 1, "Filum's version field stays 1");
  check(JSON.parse(text).nova.app.name === "NOVAstitch Designer", "nova.app says who wrote it");
}

// ---- a.4: "foo": 1 at the top, in nova and in an object survive open and save
{
  const base = readProject("Stemma.filum", filumBytes).doc as unknown as Record<string, unknown> & { objects: Record<string, unknown>[] };
  const raw = { ...base, foo: 1, nova: { ...novaDefaults(), foo: 1 }, objects: base.objects.map((o, i) => (i === 1 ? { ...o, foo: 1 } : o)) };
  const saved = nsdText(readProject("Foo.nsd", new TextEncoder().encode(JSON.stringify(raw))).doc);
  const back = JSON.parse(saved);
  check(back.foo === 1, "a.4 foo at the top is still there, value 1");
  check(back.nova.foo === 1, "a.4 foo in nova is still there, value 1");
  check(back.objects[1].foo === 1, "a.4 foo in the object is still there, value 1");
  // deeper unknown fields too: in an object's nova, in the stitch parameters, in ext
  const deep = { ...raw, nova: { ...raw.nova, ext: { "org.example.campo": { a: [1, 2] } } }, objects: raw.objects.map((o, i) => (i === 0 ? { ...o, nova: { edited: ["stitch.angle"], bar: true }, stitch: { ...(o.stitch as object), baz: "z" } } : o)) };
  const d2 = JSON.parse(nsdText(readProject("Deep.nsd", new TextEncoder().encode(JSON.stringify(deep))).doc));
  check(d2.objects[0].nova.bar === true && d2.objects[0].stitch.baz === "z" && d2.nova.ext["org.example.campo"].a[1] === 2, "a.4 unknown fields at any depth are kept");
}

// patch groups (contract, section 2): a group whose objects are all gone is removed on saving; the others stay as written
{
  const d = readProject("P.filum", filumBytes).doc;
  const ids = d.objects.map((o) => o.id);
  const cell = (objectIds: string[]) => ({ row: 0, col: 0, objectIds });
  const group = (id: string, objectIds: string[]) => ({ id, sourceIds: [ids[0]], rows: 1, cols: 1, gap: [2, 2] as [number, number], order: "rows" as const, colorGrouping: "byColor" as const, cells: [cell(objectIds)] });
  const withGroups = { ...d, nova: { ...d.nova!, patchGroups: [group("g1", [ids[0], "gone"]), group("g2", ["gone1", "gone2"])] } };
  const back = JSON.parse(nsdText(withGroups));
  check(back.nova.patchGroups.length === 1 && back.nova.patchGroups[0].id === "g1", `a group with no object left is removed on saving (${back.nova.patchGroups.map((g: { id: string }) => g.id).join(", ")})`);
  check(JSON.stringify(back.nova.patchGroups[0].cells[0].objectIds) === JSON.stringify([ids[0], "gone"]), "…a group with objects left is written as it is (missing ids are ignored by readers)");
}

done("module a, save and read back");
