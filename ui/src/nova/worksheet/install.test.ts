// Module l at start: its commands and spaces. Contract tests l.15 (names),
// l.16 (Filum's «Print PDF» gives the module's sheet), l.19 (no print dialog),
// l.20 (l.thread.setKind and one undo); the thread type picker and the option
// of the machine export; anchors.

import { check, done } from "../core/testkit";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useStore } from "../../store";
import { runCommand } from "../core/commands";
import { emit, on } from "../core/events";
import { setLanguage } from "../core/i18n";
import { buildMenus } from "../../components/menuModel";
import { ThreadManager } from "../../components/ThreadManager";
import { t as tFilum } from "../i18n/filum";
import type { StitchDocument } from "../../types";
import type { SheetIo } from "./export";
import { install } from "./install";
import { ExportSheetOption, setSheetWithExport } from "./ui";
import { design, line, loadShippedPresets, planOf, thread } from "./testkit";
import anchors from "./anchors.json";

(async () => {
  loadShippedPresets();
  setLanguage("it");
  const st = () => useStore.getState();
  const settle = () => new Promise((r) => setTimeout(r, 30));

  // a file system in memory: what the module writes, and what the user would pick
  const written: { path: string; bytes: Uint8Array; picked: boolean; suggested?: string }[] = [];
  const toasts: string[] = [];
  let pick: string | null = "/lavori/scelta.pdf";
  const io: SheetIo = {
    plan: async (d) => planOf(d),
    write: async (p, bytes) => void written.push({ path: p, bytes, picked: false }),
    saveAs: async (suggested, bytes) => {
      if (pick) written.push({ path: pick, bytes, picked: true, suggested });
      return pick;
    },
    toast: (text) => void toasts.push(text),
  };
  const exported: string[] = [];
  on("sheet.exported", ({ path }) => void exported.push(path));

  const doc: StitchDocument = design([line("o1", "T1", 10), line("o2", "T2", 30)], [thread("T1", "#cc0000", { name: "Rosso" }), thread("T2", "#c9a227", { name: "Oro" })]);
  useStore.setState({ doc, past: [], future: [], filePath: "/lavori/progetto.nsd", dialog: null });
  const off = install(io);

  // ---- l.20 the thread type, one undo step
  runCommand("l.thread.setKind", { threadId: "T2", kind: "metallic" });
  check(st().doc.threads[1].nova?.kind === "metallic" && st().past.length === 1, "l.thread.setKind: il filo diventa metallico, un passo di annulla");
  runCommand("l.thread.setKind", { threadId: "T2", kind: "metallic" });
  check(st().past.length === 1, "di nuovo metallico: nessun passo in più");
  st().undo();
  check(st().doc.threads[1].nova === undefined && st().doc === doc, "l.20 il filo torna standard con un solo annullamento");
  runCommand("l.thread.setKind", { threadId: "T2", kind: "metallic" });
  runCommand("l.thread.setKind", { threadId: "T2", kind: "standard" });
  check(st().doc.threads[1].nova === undefined && st().past.length === 2, "di nuovo standard: il campo torna al default (assente)");
  runCommand("l.thread.setKind", { threadId: "T2", kind: "wool" as never });
  check(st().past.length === 2, "un tipo sconosciuto non cambia nulla");
  useStore.setState({ doc, past: [], future: [] });

  // ---- l.16 / l.19 File › «Print PDF»: the module's sheet, straight to the file chosen, no print dialog
  const item = buildMenus().File.find((i) => i !== "-" && i.label === tFilum("filum.menu.print_pdf"));
  check(!!item && item !== "-", "File › Print PDF c'è, con l'etichetta di Filum");
  if (item && item !== "-") item.run?.();
  await settle();
  check(st().dialog !== "production", "l.16 la stampa di Filum non si apre più");
  check(written.length === 1 && written[0].picked && written[0].suggested === "progetto.pdf", `l.15 dal menu: si sceglie dove salvare «progetto.pdf» (${written[0]?.suggested})`);
  check(new TextDecoder().decode(written[0]?.bytes.slice(0, 5)) === "%PDF-", "l.19 il file è un PDF scritto direttamente");
  check(st().past.length === 0, "la scheda non cambia il disegno: nessun passo di annulla");
  check(exported.join() === "/lavori/scelta.pdf" && toasts.some((x) => x.includes("scelta.pdf")), "evento sheet.exported e avviso con il nome del file");
  pick = null;
  runCommand("l.sheet.export", {});
  await settle();
  check(written.length === 1 && exported.length === 1, "scelta annullata: niente file, niente evento");
  runCommand("l.sheet.export", { path: "/x/diretto.pdf", fileName: "ricamo.dst" });
  await settle();
  check(written.length === 2 && written[1].path === "/x/diretto.pdf" && !written[1].picked, "l.sheet.export({path}): scritto lì, senza chiedere");

  // ---- the option of the machine export: the sheet beside the stitch file
  const html = (format: string) => renderToStaticMarkup(createElement(ExportSheetOption, { format }));
  check(html("dst").includes('data-nova-anchor="l.export.sheet"') && html("dst").includes("Salva anche la scheda di lavoro (PDF)"), "nell'esportazione macchina: l'opzione della scheda");
  check(html("png_realistic") === "" && html("csv") === "" && html("svg") === "", "nessuna opzione per immagini e file di dati");
  setSheetWithExport(false, false);
  emit("file.exported", { path: "/lavori/ricamo.dst", format: "dst" });
  await settle();
  check(written.length === 2, "opzione spenta: nessuna scheda");
  setSheetWithExport(true, false);
  emit("file.exported", { path: "C:\\lavori\\ricamo.dst", format: "dst" });
  await settle();
  check(written.length === 3 && written[2].path === "C:\\lavori\\ricamo.pdf" && !written[2].picked, "l.15 opzione accesa: «ricamo.pdf» accanto a «ricamo.dst», senza chiedere");
  setSheetWithExport(false, false);

  // ---- the thread type on every thread of the thread panel (module 0's space)
  const served = { ...doc, threads: [thread("T1", "#cc0000", { name: "Rosso" }), thread("T2", "#c9a227", { name: "Oro", nova: { kind: "metallic" } })] };
  useStore.setState({ doc: served });
  Object.assign(useStore.getInitialState(), { doc: served });
  const panel = renderToStaticMarkup(createElement(ThreadManager, { onClose: () => {} }));
  const rows = panel.split('class="tm-row').slice(1);
  check(rows.length === 2 && rows.every((r) => /data-nova="l"[^>]*>(<[^>]+>)*.*data-nova-anchor="l.thread.kind"/.test(r)), "il selettore standard / metallico su ogni filo, marcato data-nova=\"l\"");
  check(/<option value="metallic" selected="">Metallico/.test(rows[1]) && /<option value="standard" selected="">Standard/.test(rows[0]), "mostra il tipo di ogni filo");
  setLanguage("en");
  check(renderToStaticMarkup(createElement(ThreadManager, { onClose: () => {} })).includes("Metallic"), "l.18 in English");
  setLanguage("it");

  // ---- anchors: the code's data-nova-anchor = anchors.json
  const dir = path.resolve(process.cwd(), "src/nova/worksheet");
  const code = readdirSync(dir).filter((f) => f.endsWith(".tsx")).map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n");
  const inCode = new Set([...code.matchAll(/data-nova-anchor="([^"]+)"/g)].map((m) => m[1]));
  const listed = new Set(Object.keys(anchors));
  check([...inCode].every((a) => listed.has(a) && a.startsWith("l.")) && [...listed].every((a) => inCode.has(a)), `ancore del codice = anchors.json (${[...inCode].join(", ")})`);

  off();
  useStore.setState({ dialog: null });
  const again = buildMenus().File.find((i) => i !== "-" && i.label === tFilum("filum.menu.print_pdf"));
  if (again && again !== "-") again.run?.();
  check(st().dialog === "production", "modulo tolto: torna la finestra di Filum");
  done("module l install");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
