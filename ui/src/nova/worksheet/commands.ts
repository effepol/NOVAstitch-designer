// Module l's commands:
//   l.sheet.export({path?, fileName?})  the work sheet as PDF: to `path` when
//       given (the option of the machine export: beside the stitch file), else
//       the user picks where (File › «Print PDF», Ctrl+P). The document does
//       not change: no undo step. Emits sheet.exported({path}).
//   l.thread.setKind({threadId, kind})  standard / metallic: one undo step.

import { registerCommand } from "../core/commands";
import type { StitchDocument } from "../../types";
import type { ThreadKind } from "./sheetData";

declare module "../core/events" {
  interface NovaEvents {
    "sheet.exported": { path: string };
    /** Proposed to module 0: a machine file written by the export dialog. */
    "file.exported": { path: string; format: string };
  }
}

export interface ExportParams {
  /** Where to write the PDF; absent: the user picks. */
  path?: string;
  /** The stitch file's name printed on the sheet; absent: the project's .nsd. */
  fileName?: string;
}
export interface SetKindParams {
  threadId: string;
  kind: ThreadKind;
}

/** The thread with its kind: metallic in nova.kind, standard = no kind (the default). */
export function setThreadKind(doc: StitchDocument, { threadId, kind }: SetKindParams): StitchDocument {
  const i = doc.threads.findIndex((t) => t.id === threadId);
  if (i < 0 || (kind !== "standard" && kind !== "metallic")) return doc;
  const th = doc.threads[i];
  const now = th.nova?.kind === "metallic" ? "metallic" : "standard";
  if (now === kind) return doc;
  const { kind: _old, ...rest } = th.nova ?? {};
  void _old;
  const nova = kind === "metallic" ? { ...rest, kind } : rest;
  const { nova: _n, ...bare } = th;
  void _n;
  const next = Object.keys(nova).length ? { ...bare, nova } : bare;
  const threads = [...doc.threads];
  threads[i] = next;
  return { ...doc, threads };
}

/** Register the commands; `exportSheet` does the writing (export.ts). */
export function installCommands(exportSheet: (p: ExportParams) => void): () => void {
  const offs = [
    registerCommand<ExportParams>({
      id: "l.sheet.export",
      label: { it: "Scheda di lavoro (PDF)", en: "Work sheet (PDF)" },
      apply(doc, params) {
        exportSheet(params ?? {});
        return doc;
      },
    }),
    registerCommand<SetKindParams>({
      id: "l.thread.setKind",
      label: { it: "Tipo di filo", en: "Thread type" },
      apply: setThreadKind,
    }),
  ];
  return () => offs.forEach((off) => off());
}
