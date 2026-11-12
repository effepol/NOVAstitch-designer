// Contract tests a.2, a.3, a.5, a.6, a.7 in the app (module a through module 0's
// hooks): File ▸ Open and File ▸ Save of Filum's actions, on a real folder.
// Also a.9's automatic half: the .nsd files are associated with the app.

import { check, done } from "../core/testkit";
import { mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { useStore } from "../../store";
import { setLanguage } from "../core/i18n";
import { on } from "../core/events";
import { openBytes, saveDocument } from "../../lib/actions";
import { projectFormat } from "../core/project";
import { installFormat } from "./install";
import { nsdText } from "./serialize";
import type { FileOps } from "./atomic";

setLanguage("it");
const root = path.resolve(process.cwd(), "..");
const dir = mkdtempSync(path.join(tmpdir(), "nova-app-"));
const fixture = readFileSync(path.join(root, "schema", "examples", "Stemma.filum"));
const filumPath = path.join(dir, "Stemma.filum");
writeFileSync(filumPath, fixture);

const disk: FileOps = {
  write: async (p, b) => writeFileSync(p, b),
  read: async (p) => readFileSync(p),
  rename: async (a, b) => renameSync(a, b),
  remove: async (p) => rmSync(p, { force: true }),
  list: async (d) => readdirSync(d),
};
// the Save dialog: what it was asked, what the user picks
const asked: { defaultPath: string; extensions: string }[] = [];
let answer: string | null = null;
const askPath = async (defaultPath: string, filters: { extensions: string[] }[]) => {
  asked.push({ defaultPath, extensions: filters.map((f) => f.extensions.join()).join(";") });
  return answer;
};
const toasts: string[] = [];
useStore.setState({ toast: ((m: string) => void toasts.push(m)) as never });
const state = () => useStore.getState();
const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);
const listing = () => readdirSync(dir).sort().join(", ");
const events: string[] = [];
on("doc.loaded", () => events.push("loaded"));
on("doc.saved", () => events.push("saved"));

(async () => {
  const off = installFormat({ fs: disk, askPath });
  check(projectFormat()?.module === "a", "module a registers the project format");

  // ---- a.2: the Filum sample opened from Stemma.filum, then Save: it asks where to save Stemma.nsd
  await openBytes("Stemma.filum", filumPath, new Uint8Array(fixture));
  check(state().doc.nova?.schemaVersion === 1 && state().doc.objects.length > 0, "a.1 in the app: the .filum opens with nova schema 1");
  answer = path.join(dir, "Stemma.nsd");
  check(await saveDocument(), "a.2 Save works");
  check(asked.length === 1 && path.basename(asked[0].defaultPath) === "Stemma.nsd" && path.dirname(asked[0].defaultPath) === dir && asked[0].extensions === "nsd", `a.2 Save asked where to save Stemma.nsd, next to the .filum (${JSON.stringify(asked[0])})`);
  check(equal(readFileSync(filumPath), fixture), "a.2 the .filum has the same bytes as before");
  check(listing() === "Stemma.filum, Stemma.nsd", `a.2 / a.7 the .nsd is written, no temporary file left (${listing()})`);
  const first = readFileSync(path.join(dir, "Stemma.nsd"));
  check(new TextDecoder().decode(first) === nsdText(state().doc), "the .nsd holds the design as module a writes it");
  check(state().saved && state().filePath === path.join(dir, "Stemma.nsd"), "the design is saved, and its file is now the .nsd");

  // ---- a.3 in the app: Save again writes in place, without asking, with identical bytes
  useStore.setState({ saved: false });
  check(await saveDocument(), "Save on the .nsd works");
  check(asked.length === 1, "Save on a .nsd does not ask");
  check(equal(readFileSync(path.join(dir, "Stemma.nsd")), first), "a.3 saved again: identical bytes");
  // opened again and saved again: identical bytes
  await openBytes("Stemma.nsd", path.join(dir, "Stemma.nsd"), first);
  await saveDocument();
  check(asked.length === 1 && equal(readFileSync(path.join(dir, "Stemma.nsd")), first), "a.3 the .nsd opened and saved: identical bytes, nothing asked");

  // ---- a.7 in the app: the rename fails: the .nsd has the same bytes, no temporary left, the design stays unsaved
  off();
  const off2 = installFormat({ fs: { ...disk, rename: async () => { throw new Error("simulated: disk removed"); } }, askPath });
  useStore.setState({ saved: false });
  check(!(await saveDocument()) && !state().saved, "a.7 a failed save is not a save");
  check(equal(readFileSync(path.join(dir, "Stemma.nsd")), first) && listing() === "Stemma.filum, Stemma.nsd", `a.7 the .nsd has the same bytes, no temporary left (${listing()})`);
  check(toasts.some((t) => t.includes("simulated: disk removed")), "a.7 the user is told why");
  off2();
  installFormat({ fs: disk, askPath });

  // a .filum chosen in the Save dialog is refused; the .filum stays as it was
  await openBytes("Stemma.filum", filumPath, new Uint8Array(fixture));
  answer = filumPath;
  toasts.length = 0;
  check(!(await saveDocument()) && equal(readFileSync(filumPath), fixture), "a.2 a .filum chosen in the dialog is never written");
  check(toasts.some((t) => t.includes(".nsd")), `…and the user is told (${toasts.join(" | ")})`);

  // ---- a.5: a .nsd from a newer version opens read-only with the warning; Save asks for a new name
  const newer = JSON.parse(new TextDecoder().decode(first));
  newer.nova.schemaVersion = 99;
  const futuro = path.join(dir, "Futuro.nsd");
  const futuroBytes = new TextEncoder().encode(JSON.stringify(newer, null, 2));
  writeFileSync(futuro, futuroBytes);
  toasts.length = 0;
  await openBytes("Futuro.nsd", futuro, futuroBytes);
  check(toasts.some((t) => /creato da una versione più recente/.test(t)), `a.5 the warning is shown (${toasts.join(" | ")})`);
  const nAsked = asked.length;
  answer = futuro;
  check(!(await saveDocument()) && asked.length === nAsked + 1 && path.basename(asked.at(-1)!.defaultPath) !== "Futuro.nsd", `a.5 Save asks for a new name (${asked.at(-1)?.defaultPath})`);
  check(equal(readFileSync(futuro), futuroBytes), "a.5 the read-only file itself is refused: same bytes");
  answer = path.join(dir, "Futuro (copia).nsd");
  check(await saveDocument(), "a.5 another name is saved");
  useStore.setState({ saved: false });
  await saveDocument();
  check(asked.length === nAsked + 3, "a.5 the design stays from a newer version: Save keeps asking for a name");

  // ---- a.6: a .nsd cut in half: «File danneggiato: …» with the name; the open design does not change
  const full = readFileSync(path.join(dir, "Stemma.nsd"));
  const before = state().doc;
  const nEvents = events.length;
  toasts.length = 0;
  await openBytes("Rotto.nsd", path.join(dir, "Rotto.nsd"), full.slice(0, Math.floor(full.length / 2)));
  check(toasts.includes("File danneggiato: Rotto.nsd"), `a.6 «File danneggiato: Rotto.nsd» (${toasts.join(" | ")})`);
  check(state().doc === before && events.length === nEvents, "a.6 the design open before is unchanged, nothing loaded");

  // a new design (no nova block yet) is saved with a complete nova block
  useStore.setState({ doc: { ...state().doc, nova: undefined, name: "Nuovo" } });
  const { loadDoc } = await import("../../lib/actions");
  loadDoc({ ...state().doc, nova: undefined, name: "Nuovo" }, null);
  answer = path.join(dir, "Nuovo.nsd");
  await saveDocument();
  const nuovo = JSON.parse(readFileSync(path.join(dir, "Nuovo.nsd"), "utf8"));
  check(nuovo.nova?.schemaVersion === 1 && nuovo.nova.mode === "studio" && nuovo.nova.app?.name === "NOVAstitch Designer", "a design without nova is saved with the complete block");

  // ---- a.9 (automatic half): the app is the program for .nsd files on Windows, macOS and Linux
  const conf = JSON.parse(readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"));
  const assoc = (conf.bundle?.fileAssociations ?? []) as { ext: string[]; role?: string; mimeType?: string; exportedType?: { identifier: string; conformsTo?: string[] } }[];
  const nsd = assoc.filter((a) => a.ext.map((e) => e.toLowerCase()).includes("nsd"));
  check(nsd.length === 1 && nsd[0].ext.length === 1, "a.9 one association for .nsd, of its own");
  check(nsd[0]?.role === "Editor", "a.9 the app opens .nsd files as their editor");
  check(!!nsd[0]?.mimeType && /^application\//.test(nsd[0].mimeType!), "a.9 Linux: a MIME type for .nsd");
  check(!!nsd[0]?.exportedType?.identifier && nsd[0].exportedType.identifier.startsWith(conf.identifier), "a.9 macOS: the .nsd type is declared by the app (exported UTI)");
  check(assoc.some((a) => a.ext.includes("filum")), "the .filum files stay associated too (they open, they are not written)");

  done("module a in the app");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
