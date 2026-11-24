// file.exported (module 0, request of 24/11, for module l's «save the work
// sheet too»): lib/exportFiles.ts sends {path, format} once the machine file
// is written. Not for pictures, data or project files, not when the user
// cancels the save dialog, not when the export fails.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { emptyDoc, useStore } from "../../store";
import { on } from "./events";
import { exportTarget, PICTURE_SETTINGS } from "../../lib/exportFiles";
import type { ExportOptions } from "../../types";

useStore.setState({ doc: { ...emptyDoc(), name: "ricamo" } });
const seen: { path: string; format: string }[] = [];
const off = on("file.exported", (p) => void seen.push(p));
const opts = {} as ExportOptions;
const written: string[] = [];
const save = (where: string | null) => async (name: string) => (written.push(name), where);

void (async () => {
  // "filum" makes its bytes without the engine (Node has none); the dialog tells exportTarget whether the format is a machine one
  await exportTarget("filum", opts, PICTURE_SETTINGS, "ricamo", true, save("/lavori/ricamo.dst"));
  check(written.length === 1 && seen.length === 1 && seen[0].path === "/lavori/ricamo.dst" && seen[0].format === "filum", "a machine file written: file.exported {path, format}");
  await exportTarget("filum", opts, PICTURE_SETTINGS, "ricamo", false, save("/lavori/ricamo.filum"));
  check(written.length === 2 && seen.length === 1, "not a machine file (picture, data, project): no event");
  await exportTarget("filum", opts, PICTURE_SETTINGS, "ricamo", true, save(null));
  check(seen.length === 1, "the save dialog cancelled: no event");
  const err = console.error;
  await exportTarget("filum", opts, PICTURE_SETTINGS, "ricamo", true, async () => {
    throw new Error("disco pieno");
  });
  console.error = err;
  check(seen.length === 1, "the file not written: no event");
  off();

  const dlg = readFileSync(path.join(process.cwd(), "src", "components", "ExportDialog.tsx"), "utf8");
  check(/exportTarget\(fmt, opts, pics, fileName, isMachine\(fmt\)\)/.test(dlg), "the export dialog says whether the format is a machine one (its own rule: not project, data or picture)");
  const events = readFileSync(path.join(process.cwd(), "src", "nova", "core", "events.ts"), "utf8");
  check(/"file\.exported": \{ path: string; format: string \}/.test(events), "file.exported is one of the common events (module 0 sends it)");
  done("evento file.exported");
})();
