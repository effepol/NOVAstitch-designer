// Module a, project files: registered with module 0's project format hook.
// Opening reads, migrates or refuses (readProject); Save decides where (planSave,
// chooseTarget) and writes in two steps (writeAtomic). The file the design came
// from is learnt from doc.loaded and doc.saved.

import { on } from "../core/events";
import { t } from "../core/i18n";
import { registerProjectFormat } from "../core/project";
import { splitPath, tauriFileOps, writeAtomic, type FileOps } from "./atomic";
import { PROJECT_EXT, readProject } from "./read";
import { chooseTarget, planSave, type Source } from "./savePlan";
import { nsdBytes } from "./serialize";
import "./texts";

/** The Save dialog: the full default path and the filters; the path chosen, or null. */
export type AskPath = (defaultPath: string, filters: { name: string; extensions: string[] }[]) => Promise<string | null>;

export function installFormat(deps: { fs: FileOps; askPath: AskPath }): () => void {
  let source: Source = { path: null, readOnly: false };
  const offs = [
    on("doc.loaded", (p) => {
      source = { path: p.path, readOnly: p.readOnly };
    }),
    on("doc.saved", (p) => {
      // a design from a newer version stays one: its Save keeps asking (and never writes over the original)
      if (!source.readOnly) source = { path: p.path, readOnly: false };
    }),
    registerProjectFormat({
      module: "a",
      extensions: [...PROJECT_EXT],
      filterName: () => t("a.save.filter"),
      read: readProject,
      async save(doc, { saveAs }) {
        const plan = planSave(source, saveAs, doc.name);
        let target: string;
        if (plan.ask) {
          const dir = source.path ? splitPath(source.path).dir : "";
          const chosen = await deps.askPath(`${dir}${plan.suggestedName}`, plan.filters);
          if (!chosen) return null;
          const ok = chooseTarget(chosen, source);
          if (!ok.ok) throw new Error(t(ok.reason === "filum" ? "a.save.refusedFilum" : "a.save.refusedReadOnly"));
          target = ok.path;
        } else target = plan.path;
        await writeAtomic(deps.fs, target, nsdBytes(doc));
        return target;
      },
    }),
  ];
  return () => offs.forEach((off) => off());
}

/** The desktop app's Save dialog. */
const tauriAskPath: AskPath = async (defaultPath, filters) => {
  const { save } = await import("@tauri-apps/plugin-dialog");
  return save({ defaultPath, filters });
};

/** Started by module 0 (nova/core/modules.ts). */
export function install(): void {
  installFormat({ fs: tauriFileOps(), askPath: tauriAskPath });
}
