// «Salva» (module a): a .nsd that can be written is saved in place; anything
// else (a .filum, a .json, a new design, a file from a newer version, Save as)
// asks for a name, and the name chosen is a .nsd. A .filum is never written,
// and a read-only file is never written over.

import { t } from "../core/i18n";
import { isNsd, splitPath } from "./atomic";
import "./texts";

/** The file the open design came from (doc.loaded tells module a). */
export interface Source {
  path: string | null;
  readOnly: boolean;
}

export type SavePlan =
  | { ask: false; path: string }
  | { ask: true; suggestedName: string; filters: { name: string; extensions: string[] }[] };

const stem = (name: string) => name.replace(/\.[^.]*$/, "");

export function planSave(src: Source, saveAs: boolean, docName: string): SavePlan {
  if (src.path && isNsd(src.path) && !src.readOnly && !saveAs) return { ask: false, path: src.path };
  const base = src.path ? stem(splitPath(src.path).name) : docName.trim() || "design";
  const name = src.readOnly ? t("a.save.copyName", { name: base }) : base;
  return { ask: true, suggestedName: `${name}.nsd`, filters: [{ name: t("a.save.filter"), extensions: ["nsd"] }] };
}

export type Target = { ok: true; path: string } | { ok: false; reason: "filum" | "readOnly" };

/** The name chosen in the dialog: a .filum is refused, a missing .nsd is added, the read-only source is refused. */
export function chooseTarget(chosen: string, src: Source): Target {
  if (/\.filum$/i.test(chosen)) return { ok: false, reason: "filum" };
  const path = isNsd(chosen) ? chosen : `${chosen}.nsd`;
  if (src.readOnly && src.path && path.toLowerCase() === src.path.toLowerCase()) return { ok: false, reason: "readOnly" };
  return { ok: true, path };
}
