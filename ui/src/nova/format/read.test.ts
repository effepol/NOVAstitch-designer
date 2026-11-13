// Contract tests a.1, a.4, a.5, a.6 (module a, reading): the bytes of a .nsd,
// .filum or .json become a document with a complete nova block, or a clear error.

import { check, done } from "../core/testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { useStore } from "../../store";
import { setLanguage } from "../core/i18n";
import { readProject, DamagedFileError } from "./read";
import { NOVA_SCHEMA, novaDefaults } from "./nova";
import type { StitchDocument } from "../../types";

const examples = path.resolve(process.cwd(), "..", "schema", "examples");
const filumText = readFileSync(path.join(examples, "Stemma.filum"), "utf8");
const filum = JSON.parse(filumText) as StitchDocument;
const enc = new TextEncoder();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ---- a.1: the Filum sample, saved by Filum 0.2.1 as .filum
{
  const r = readProject("Stemma.filum", enc.encode(filumText));
  check(r.kind === "filum" && r.fromSchema === 0 && r.migrated && !r.readOnly, `a.1 a .filum is schema 0, migrated, writable (${r.kind}, ${r.fromSchema}, ${r.migrated}, ${r.readOnly})`);
  check(r.doc.nova?.schemaVersion === 1 && NOVA_SCHEMA === 1, `a.1 nova.schemaVersion = 1 (${r.doc.nova?.schemaVersion})`);
  check(same(r.doc.nova, novaDefaults()), `a.1 nova holds the defaults (${JSON.stringify(r.doc.nova)})`);
  check(r.doc.nova?.app === undefined, "a.1 nova.app is absent until NOVAstitch writes the file");
  check(r.doc.objects.length === filum.objects.length && filum.objects.length > 0, `a.1 every object is there (${r.doc.objects.length}/${filum.objects.length})`);
  const diff = filum.objects.filter((o, i) => !same(o, r.doc.objects[i]) || Object.keys(o).join() !== Object.keys(r.doc.objects[i]).join());
  check(diff.length === 0, `a.1 every object identical field by field, in the same order (different: ${diff.map((o) => o.id).join(", ") || "none"})`);
  const { nova: _nova, ...rest } = r.doc;
  check(same(rest, filum), "a.1 every Filum field of the document is as it was");
  check(r.warnings.length === 0, `a.1 no warnings (${r.warnings.join("; ")})`);
}

// a .json is read as a project too; its kind is kept (it is never written over either)
{
  const r = readProject("Disegno.JSON", enc.encode(filumText));
  check(r.kind === "json" && r.doc.nova?.schemaVersion === 1, `a.1 a .json design opens the same way (${r.kind})`);
}

// ---- a.4 (reading): unknown fields at the top, in nova, in an object are kept
{
  const raw = { ...filum, foo: 1, nova: { ...novaDefaults(), foo: 1 }, objects: filum.objects.map((o, i) => (i === 2 ? { ...o, foo: 1 } : o)) };
  const r = readProject("Stemma.nsd", enc.encode(JSON.stringify(raw, null, 2)));
  const d = r.doc as unknown as Record<string, unknown> & { nova: Record<string, unknown>; objects: Record<string, unknown>[] };
  check(d.foo === 1 && d.nova.foo === 1 && d.objects[2].foo === 1, "a.4 the three foo fields are read, with value 1");
  check(r.kind === "nsd" && r.fromSchema === 1 && !r.migrated && !r.readOnly, `a.4 a current .nsd is not migrated (${r.fromSchema}, ${r.migrated})`);
}

// a .nsd written before a field was added: the missing optional fields get their defaults, the version stays
{
  const { mode: _m, ext: _e, ...older } = novaDefaults();
  const r = readProject("Vecchio.nsd", enc.encode(JSON.stringify({ ...filum, nova: { ...older, hoopRef: { id: "u1", name: "Mio" } } })));
  check(r.doc.nova?.mode === "studio" && same(r.doc.nova?.ext, {}) && r.doc.nova?.hoopRef?.id === "u1" && !r.migrated, "a missing optional nova field gets its default; the others are kept");
}

// ---- a.5: a .nsd from a newer version opens read-only, with a warning in Italian and English
for (const lang of ["it", "en"] as const) {
  setLanguage(lang);
  const raw = { ...filum, nova: { ...novaDefaults(), schemaVersion: 99, nuovo: { x: 1 } } };
  const r = readProject("Futuro.nsd", enc.encode(JSON.stringify(raw)));
  check(r.readOnly && r.fromSchema === 99 && !r.migrated, `a.5 (${lang}) schemaVersion 99 opens read-only (${r.readOnly}, ${r.fromSchema})`);
  const want = lang === "it" ? /creato da una versione più recente/i : /created by a newer version/i;
  check(r.warnings.length === 1 && want.test(r.warnings[0]), `a.5 (${lang}) the warning says so: "${r.warnings[0]}"`);
  check(same(r.doc, raw), "a.5 a newer file is left exactly as it is (nothing filled in, nothing dropped)");
}

// ---- a.6: a .nsd cut in half: "File danneggiato: …" / "Damaged file: …" with the name; nothing else changes
{
  const full = JSON.stringify({ ...filum, nova: novaDefaults() }, null, 2);
  const half = enc.encode(full.slice(0, Math.floor(full.length / 2)));
  const before = useStore.getState().doc;
  for (const lang of ["it", "en"] as const) {
    setLanguage(lang);
    let err: unknown = null;
    try {
      readProject("Stemma.nsd", half);
    } catch (e) {
      err = e;
    }
    const msg = (err as Error | null)?.message ?? "";
    const want = lang === "it" ? "File danneggiato: Stemma.nsd" : "Damaged file: Stemma.nsd";
    check(err instanceof DamagedFileError && msg.startsWith(want), `a.6 (${lang}) "${msg}"`);
    check(err instanceof DamagedFileError && err.fileName === "Stemma.nsd", "a.6 the error carries the file name");
  }
  check(useStore.getState().doc === before, "a.6 reading a damaged file does not touch the open document");
}

// other damaged files: not JSON, not a design, a nova block that is not one, bad bytes
const damaged: [string, Uint8Array][] = [
  ["empty", new Uint8Array()],
  ["a number", enc.encode("42")],
  ["no objects", enc.encode(JSON.stringify({ version: 1, name: "x" }))],
  ["nova not an object", enc.encode(JSON.stringify({ ...filum, nova: [1] }))],
  ["schemaVersion not a whole number", enc.encode(JSON.stringify({ ...filum, nova: { ...novaDefaults(), schemaVersion: "1" } }))],
  ["negative schemaVersion", enc.encode(JSON.stringify({ ...filum, nova: { ...novaDefaults(), schemaVersion: -1 } }))],
  ["not UTF-8", new Uint8Array([0x7b, 0xff, 0xfe, 0x7d])],
];
for (const [what, bytes] of damaged) {
  let ok = false;
  try {
    readProject("X.nsd", bytes);
  } catch (e) {
    ok = e instanceof DamagedFileError;
  }
  check(ok, `a.6 ${what}: a damaged file`);
}

// a byte order mark at the start is not damage
{
  const r = readProject("Bom.filum", new Uint8Array([0xef, 0xbb, 0xbf, ...enc.encode(filumText)]));
  check(r.doc.objects.length === filum.objects.length, "a file starting with a byte order mark opens");
}

setLanguage("en");
done("module a, reading");
