// The nova block (contract, section 2): its schema version and its defaults.
// nova.schemaVersion goes up by 1 only for an incompatible change; a new
// optional field with a default leaves it as it is.

import type { NovaDocument } from "../../types";

/** The schema version this program reads and writes. */
export const NOVA_SCHEMA = 1;

/** Who writes the file (nova.app), for diagnosis. */
export const APP = { name: "NOVAstitch Designer", version: "0.1.0" } as const;

/** The nova block of a design that has none (a Filum file): every field at its default. nova.app stays absent. */
export function novaDefaults(): NovaDocument {
  return {
    schemaVersion: NOVA_SCHEMA,
    hoopRef: null,
    hoopKind: "flat",
    fabricPreset: null,
    edit: { mirrorPivot: "selection", duplicateOffset: [0, 0] },
    patchGroups: [],
    mode: "studio",
    lesson: null,
    ext: {},
  };
}
