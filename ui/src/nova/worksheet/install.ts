// Module l at start (started by module 0, nova/core/modules.ts):
//   commands   l.sheet.export (File › «Print PDF» and Ctrl+P run it: module 0's
//              hook, nova/core/print.ts), l.thread.setKind
//   spaces     the thread type on every thread; the work sheet option in the
//              export dialog
//   events     after a machine export (file.exported, from module 0) with the
//              option on: the sheet beside the stitch file, same base name

import { isTauri } from "../../lib/platform";
import { on } from "../core/events";
import { prefs } from "../core/prefs";
import { registerSlot } from "../core/slots";
import { installCommands } from "./commands";
import { besideFile, exportSheet, type SheetIo } from "./export";
import { ExportSheetOption, onSheetOptionSave, setSheetWithExport, sheetWithExport, ThreadKindPicker } from "./ui";
import "./texts";

export const OPTION_PREF = "l.sheetWithExport";

export function install(io?: SheetIo): () => void {
  const run = (p: Parameters<typeof exportSheet>[0]) => void exportSheet(p, io);
  const offs = [
    installCommands(run),
    registerSlot({ id: "l.threadKind", module: "l", slot: "thread", Component: ThreadKindPicker }),
    registerSlot({ id: "l.exportSheet", module: "l", slot: "export", Component: ExportSheetOption }),
    on("file.exported", ({ path }) => {
      if (!sheetWithExport()) return;
      const name = path.split(/[\\/]/).pop() ?? path;
      run({ path: besideFile(path), fileName: name });
    }),
  ];
  if (isTauri) {
    prefs()
      .then((p) => {
        setSheetWithExport(p.get<boolean>(OPTION_PREF) === true, false);
        onSheetOptionSave((v) => void p.set(OPTION_PREF, v).catch((e) => console.warn("nova: the work sheet option was not saved", e)));
      })
      .catch((e) => console.warn("nova: the work sheet option starts off (settings not readable)", e));
  }
  return () => offs.forEach((off) => off());
}
