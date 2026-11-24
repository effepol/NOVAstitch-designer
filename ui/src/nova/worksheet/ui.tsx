// Module l's interface, in module 0's spaces:
//   thread  on every thread of Filum's thread panel: standard / metallic
//           (l.thread.setKind, one undo step)
//   export  in the export dialog: «also the work sheet (PDF)», written beside
//           the stitch file with the same base name when the export is saved

import { useSyncExternalStore } from "react";
import type { Thread } from "../../types";
import { runCommand } from "../core/commands";
import { getLanguage, onLanguageChange, t } from "../core/i18n";
import { threadKind } from "./sheetData";
import "./texts";

/** Re-render when the language changes (as core's useLanguage, also when rendered outside the browser). */
const useLanguage = () => useSyncExternalStore(onLanguageChange, getLanguage, getLanguage);

export function ThreadKindPicker({ thread }: { thread: Thread }) {
  useLanguage();
  const kind = threadKind(thread);
  return (
    <label className="tm-field" title={t("l.thread.kind.hint")}>
      <span>{t("l.thread.kind")}</span>
      <select
        data-nova-anchor="l.thread.kind"
        aria-label={t("l.thread.kind")}
        value={kind}
        onChange={(e) => runCommand("l.thread.setKind", { threadId: thread.id, kind: e.target.value })}
      >
        <option value="standard">{t("l.thread.kind.standard")}</option>
        <option value="metallic">{t("l.thread.kind.metallic")}</option>
      </select>
    </label>
  );
}

// ---- the option of the machine export: a setting of the app, remembered
let withExport = false;
const listeners = new Set<() => void>();
let save: (on: boolean) => void = () => {};

export const sheetWithExport = () => withExport;
export function setSheetWithExport(on: boolean, persist = true): void {
  withExport = on;
  if (persist) save(on);
  for (const fn of [...listeners]) fn();
}
/** Where the choice is saved (install.ts: the app's settings). */
export const onSheetOptionSave = (fn: (on: boolean) => void) => void (save = fn);

export function ExportSheetOption({ format }: { format: string }) {
  useLanguage();
  const on = useSyncExternalStore(
    (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    () => withExport,
    () => withExport,
  );
  // pictures and the Ink/Stitch SVG are not stitch files
  if (!MACHINE.test(format)) return null;
  return (
    <label className="check" data-nova-anchor="l.export.sheet">
      <input type="checkbox" checked={on} onChange={(e) => setSheetWithExport(e.target.checked)} />
      <span>{t("l.export.sheet")}</span>
    </label>
  );
}

/** Formats that are not stitch files (project, pictures, data for people and software): no work sheet with them. */
const MACHINE = /^(?!(filum|nsd|svg|zip|csv|txt|col|edr|inf|threadlist|png_\w+|pdf)$).+/i;
