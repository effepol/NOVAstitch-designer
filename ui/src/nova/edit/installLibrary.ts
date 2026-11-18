// Module f: the library in the app — the shipped files (ui/src/nova/library/),
// the command f.library.insert and its menu item (module 0's registry); its section
// sits at the top of the Patch panel (one tab: Filum's tab bar has no room for more).

import { registerCommand } from "../core/commands";
import { registerMenuItem } from "../core/registry";
import { insertItem, setLibrary, type LibraryManifest } from "./library";
import { insertChosen } from "./LibraryPanel";
import "./texts";

/** The files shipped with the app (Vite bundles them; none in the Node tests). */
export function shippedLibrary(): { manifest: LibraryManifest; files: Record<string, string> } {
  try {
    const manifest = import.meta.glob<LibraryManifest>("../library/manifest.json", { eager: true, import: "default" })["../library/manifest.json"];
    const raw = import.meta.glob<string>(["../library/**/*.svg", "../library/**/*.nsd"], { eager: true, query: "?raw", import: "default" });
    const files = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.replace("../library/", ""), v]));
    return { manifest: manifest ?? { schemaVersion: 1, items: [] }, files };
  } catch {
    return { manifest: { schemaVersion: 1, items: [] }, files: {} };
  }
}

export function installLibrary(lib = shippedLibrary()): () => void {
  setLibrary(lib.manifest, lib.files);
  const offs = [
    registerCommand({ id: "f.library.insert", label: { it: "Inserisci dalla libreria", en: "Insert from the library" }, apply: insertItem }),
    registerMenuItem({ id: "f.library.insert", module: "f", menu: "Object", label: "f.library.menu", run: insertChosen }),
  ];
  return () => {
    offs.forEach((off) => off());
    setLibrary({ schemaVersion: 1, items: [] }, {});
  };
}
