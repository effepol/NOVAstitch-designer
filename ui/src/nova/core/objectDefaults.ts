// What new objects start from (module 0, for module e): Filum's
// setFabricDefaults (lib/geometry.ts) gets module 0's composed function. It
// applies first the values the modules register (module e: the preset in
// force), then, on top, Filum's fabric calibration (Calibrate fabric…), so the
// calibration keeps working with or without a preset.

import type { FillParams, RunningParams, SatinParams } from "../../types";

export interface ObjectDefaultValues {
  satin?: Partial<SatinParams>;
  fill?: Partial<FillParams>;
  running?: Partial<RunningParams>;
}

export interface ObjectDefaultsEntry {
  /** "<module>.<name>" */
  id: string;
  module: string;
  /** The values for the design open now; read each time an object is made. */
  values(): ObjectDefaultValues;
}

const entries = new Map<string, ObjectDefaultsEntry>();

export function registerObjectDefaults(e: ObjectDefaultsEntry): () => void {
  if (entries.has(e.id)) throw new Error(`Object defaults "${e.id}" from module "${e.module}" are already registered`);
  entries.set(e.id, e);
  return () => {
    if (entries.get(e.id) === e) entries.delete(e.id);
  };
}

/** The function for setFabricDefaults: the registered values, then `calibrated` on top. */
export function composedFabricDefaults(calibrated: () => { satin?: Partial<SatinParams>; fill?: Partial<FillParams> }): () => ObjectDefaultValues {
  return () => {
    const out: ObjectDefaultValues = {};
    const layers: ObjectDefaultValues[] = [];
    for (const e of entries.values()) {
      try {
        layers.push(e.values());
      } catch (err) {
        console.error(`nova: object defaults "${e.id}" failed`, err);
      }
    }
    layers.push(calibrated());
    for (const l of layers) {
      if (l.satin) out.satin = { ...out.satin, ...l.satin };
      if (l.fill) out.fill = { ...out.fill, ...l.fill };
      if (l.running) out.running = { ...out.running, ...l.running };
    }
    return out;
  };
}
