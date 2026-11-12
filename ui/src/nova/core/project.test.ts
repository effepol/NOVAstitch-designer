// Hook test (module 0, innesti for module a): opening and saving a project go
// through the registered project format. Without one, Filum's behaviour is unchanged.

import { check, done } from "./testkit";
import { useStore } from "../../store";
import { on } from "./events";
import { loadDoc, openBytes, saveDocument } from "../../lib/actions";
import { registerProjectFormat, projectFormat, type ProjectFormat } from "./project";
import type { StitchDocument } from "../../types";

const enc = new TextEncoder();
const state = () => useStore.getState();
const toasts: string[] = [];
useStore.setState({ toast: ((msg: string) => void toasts.push(msg)) as never });
const loaded: unknown[] = [];
const saved: unknown[] = [];
on("doc.loaded", (p) => loaded.push(p));
on("doc.saved", (p) => saved.push(p));
const design = (name: string): StitchDocument => ({ ...state().doc, name, objects: [] });

(async () => {
  check(projectFormat() === null, "no project format until a module registers one");

  // a format that reads .nsd/.filum and says what it did
  const reads: string[] = [];
  let saveResult: string | null | Error = "/disegni/Stemma.nsd";
  const savedDocs: { doc: StitchDocument; saveAs: boolean }[] = [];
  const fmt: ProjectFormat = {
    module: "a",
    extensions: ["nsd", "filum", "json"],
    filterName: () => "Progetto NOVAstitch",
    read(name, bytes) {
      reads.push(name);
      const text = new TextDecoder().decode(bytes);
      if (text === "broken") throw new Error(`File danneggiato: ${name}`);
      return { doc: { ...JSON.parse(text), nova: { schemaVersion: 1 } }, fromSchema: 0, migrated: true, readOnly: name.includes("99"), warnings: name.includes("99") ? ["newer"] : [] };
    },
    async save(doc, o) {
      savedDocs.push({ doc, saveAs: o.saveAs });
      if (saveResult instanceof Error) throw saveResult;
      return saveResult;
    },
  };
  const off = registerProjectFormat(fmt);
  let dup = false;
  try {
    registerProjectFormat({ ...fmt, module: "x" });
  } catch {
    dup = true;
  }
  check(projectFormat() === fmt && dup, "one project format; a second one is refused");

  // opening: the format reads, loadDoc gets what it said, doc.loaded carries it
  await openBytes("Stemma.filum", "/disegni/Stemma.filum", enc.encode(JSON.stringify(design("Stemma"))));
  check(reads.join() === "Stemma.filum" && state().doc.name === "Stemma" && state().doc.nova?.schemaVersion === 1, "a .filum is read by the project format");
  const last = loaded.at(-1) as { path: string; fromSchema: number; migrated: boolean; readOnly: boolean };
  check(last?.path === "/disegni/Stemma.filum" && last.fromSchema === 0 && last.migrated && !last.readOnly, `doc.loaded carries the format's path, fromSchema and migrated (${JSON.stringify(last)})`);

  await openBytes("Futuro99.nsd", "/disegni/Futuro99.nsd", enc.encode(JSON.stringify(design("Futuro"))));
  const ro = loaded.at(-1) as { readOnly: boolean; warnings: string[]; path: string };
  check(ro.readOnly && ro.warnings.join() === "newer" && ro.path === "/disegni/Futuro99.nsd", "a .nsd keeps its path; readOnly and warnings reach doc.loaded");
  check(toasts.includes("newer"), "the format's warnings are shown");

  // a damaged file: the error's own message, and the open design stays as it was
  const before = state().doc;
  const nLoaded = loaded.length;
  toasts.length = 0;
  await openBytes("Rotto.nsd", "/disegni/Rotto.nsd", enc.encode("broken"));
  check(state().doc === before && loaded.length === nLoaded, "a damaged file leaves the open design as it was, no doc.loaded");
  check(toasts.includes("File danneggiato: Rotto.nsd"), `the error shown is the format's own message (${toasts.join(" | ")})`);

  // saving: the format decides where and writes; doc.saved follows
  useStore.setState({ saved: false });
  check((await saveDocument()) && savedDocs.length === 1 && !savedDocs[0].saveAs && savedDocs[0].doc === state().doc, "Save hands the design to the project format");
  check(state().saved && state().filePath === "/disegni/Stemma.nsd" && JSON.stringify(saved.at(-1)) === JSON.stringify({ path: "/disegni/Stemma.nsd" }), "…the design is saved, filePath and doc.saved follow");
  await saveDocument(true);
  check(savedDocs[1]?.saveAs === true, "Save as says so to the format");
  saveResult = null;
  const nSaved = saved.length;
  useStore.setState({ saved: false });
  check(!(await saveDocument()) && !state().saved && saved.length === nSaved, "cancelled: nothing saved, no doc.saved");
  saveResult = new Error("disco pieno");
  toasts.length = 0;
  check(!(await saveDocument()) && !state().saved && toasts.some((t) => t.includes("disco pieno")), "a failed save says why and leaves the design unsaved");

  // without a format: Filum's own opening (JSON.parse) and doc.loaded with schema 0
  off();
  check(projectFormat() === null, "the format can be removed");
  reads.length = 0;
  await openBytes("Vecchio.filum", "/disegni/Vecchio.filum", enc.encode(JSON.stringify(design("Vecchio"))));
  check(reads.length === 0 && state().doc.name === "Vecchio", "without a format, Filum opens a .filum itself");
  loadDoc(design("x"), null);
  const plain = loaded.at(-1) as { fromSchema: number; migrated: boolean; readOnly: boolean };
  check(plain.fromSchema === 0 && !plain.migrated && !plain.readOnly, "loadDoc without information: schema 0, not migrated, writable (as before)");

  done("project format hook");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
