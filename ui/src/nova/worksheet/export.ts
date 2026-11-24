// Writing the work sheet (module l): the plan of the document (the editor's,
// or planned now), sheetData, the PDF, then the file, straight away: no
// system print dialog (l.19). The file system is injected so tests run in Node.

import { useStore, planOf } from "../../store";
import { engine } from "../../engine/client";
import { saveFile } from "../../lib/platform";
import type { PlanData, StitchDocument } from "../../types";
import { emit } from "../core/events";
import { t } from "../core/i18n";
import type { ExportParams } from "./commands";
import { sheetPdf } from "./pdf";
import { projectFileName, sheetData } from "./sheetData";
import "./texts";

export interface SheetIo {
  plan(doc: StitchDocument): Promise<PlanData>;
  /** Write to a known path. */
  write(path: string, bytes: Uint8Array): Promise<void>;
  /** Let the user pick where; null when cancelled. */
  saveAs(suggested: string, bytes: Uint8Array): Promise<string | null>;
  toast(text: string, kind: "success" | "error"): void;
}

export const appIo: SheetIo = {
  plan: (doc) => Promise.resolve(planOf.get(doc) ?? engine.plan(doc)),
  async write(path, bytes) {
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    await writeFile(path, bytes);
  },
  saveAs: (suggested, bytes) => saveFile(suggested, bytes, [{ name: "PDF", extensions: ["pdf"] }]),
  toast: (text, kind) => useStore.getState().toast(text, kind),
};

/** The PDF beside a stitch file: same folder, same base name. */
export const besideFile = (path: string) => path.replace(/\.[^.\\/]*$/, "") + ".pdf";
const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

export async function exportSheet(params: ExportParams, io: SheetIo = appIo, doc: StitchDocument = useStore.getState().doc): Promise<string | null> {
  try {
    const fileName = params.fileName ?? projectFileName(doc, useStore.getState().filePath);
    const plan = await io.plan(doc);
    const bytes = await sheetPdf(sheetData(doc, plan, fileName), plan);
    let path: string | null = params.path ?? null;
    if (path) await io.write(path, bytes);
    else path = await io.saveAs(fileName.replace(/\.[^.]*$/, "") + ".pdf", bytes);
    if (!path) return null;
    io.toast(t("l.exported", { file: baseName(path) }), "success");
    emit("sheet.exported", { path });
    return path;
  } catch (e) {
    io.toast(t("l.exportFailed", { message: (e as Error).message }), "error");
    return null;
  }
}
