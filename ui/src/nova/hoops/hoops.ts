// Hoop commands (module a): a.hoop.select picks a preset or one of the user's
// hoops, a.hoop.custom sets free sizes. Both write doc.hoop (what the engine
// uses), nova.hoopRef (the link to the user's list, null otherwise) and
// nova.hoopKind: "cap" for the cap frames of the industrial machines (the ones
// listed in capHoops.ts) and for user hoops of kind cap, else "flat".

import type { Hoop, HoopShape, NovaDocument, StitchDocument } from "../../types";
import { HOOPS } from "../../lib/hoops";
import { MACHINES } from "../../lib/machines";
import { registerCommand } from "../core/commands";
import { t } from "../core/i18n";
import type { UserHoops } from "./userHoops";
import { CAP_FRAMES, CAP_HOOPS } from "./capHoops";
import "./texts";

export { USER_HOOPS_FILE } from "./userHoops";

export interface PresetHoop {
  /** "hoops:<name>" for Filum's hoop presets, "machine:<machine>/<frame>" for a machine's frames. */
  id: string;
  hoop: Hoop;
  kind: "flat" | "cap";
}

const shaped = (name: string, width: number, height: number, shape?: HoopShape): Hoop => ({ name, width, height, ...(shape && shape !== "rect" ? { shape } : {}) });

/** Every preset: Filum's hoop list, then every machine's frames (named as Filum names them). */
export function presetHoops(): PresetHoop[] {
  return [
    ...HOOPS.map((h) => ({ id: `hoops:${h.name}`, hoop: shaped(h.name, h.width, h.height, h.shape), kind: CAP_HOOPS.includes(h.name) ? ("cap" as const) : ("flat" as const) })),
    ...MACHINES.flatMap((m) =>
      m.frames.map((f) => ({ id: `machine:${m.id}/${f.id}`, hoop: shaped(`${m.brand} ${f.name}`.trim(), f.width, f.height, f.shape), kind: CAP_FRAMES.includes(f.id) ? ("cap" as const) : ("flat" as const) })),
    ),
  ];
}

export interface SelectParams {
  source: "preset" | "user";
  id: string;
}
export interface CustomParams {
  name: string;
  width: number;
  height: number;
  shape: HoopShape;
}

const withHoop = (doc: StitchDocument, hoop: Hoop, hoopRef: NovaDocument["hoopRef"], hoopKind: "flat" | "cap"): StitchDocument => ({
  ...doc,
  hoop,
  nova: { schemaVersion: 1, ...doc.nova, hoopRef, hoopKind },
});
const size = (v: number) => Number.isFinite(v) && v > 0;

/** Register the hoop commands; the user's list is read when a command runs. Returns the function that removes them. */
export function installHoops(user: UserHoops): () => void {
  const offs = [
    registerCommand<SelectParams>({
      id: "a.hoop.select",
      label: { it: "Scegli il telaio", en: "Choose the hoop" },
      apply(doc, p) {
        if (p.source === "user") {
          const h = user.get(p.id);
          return h ? withHoop(doc, shaped(h.name, h.width, h.height, h.shape), { id: h.id, name: h.name }, h.kind) : doc;
        }
        const preset = presetHoops().find((x) => x.id === p.id);
        return preset ? withHoop(doc, { ...preset.hoop }, null, preset.kind) : doc;
      },
    }),
    registerCommand<CustomParams>({
      id: "a.hoop.custom",
      label: { it: "Telaio su misura", en: "Custom hoop" },
      apply: (doc, p) => (size(p.width) && size(p.height) ? withHoop(doc, shaped(p.name.trim() || t("a.hoop.customName"), p.width, p.height, p.shape), null, "flat") : doc),
    }),
  ];
  return () => offs.forEach((off) => off());
}
