// Writing a project (module a): the bytes of a .nsd. Readable JSON, indented,
// UTF-8, no compression and no encoding of any kind. The same document always
// gives the same bytes, and a .nsd read and written again is identical byte
// for byte. Unknown fields are written back as they were read.

import type { StitchDocument } from "../../types";
import { APP } from "./nova";

/** The document as it is written: nova.app names the writer; patch groups with no object left are dropped. */
export function forSaving(doc: StitchDocument): StitchDocument {
  const nova = doc.nova ?? ({ schemaVersion: 1 } as NonNullable<StitchDocument["nova"]>);
  const out = { ...nova, app: { name: APP.name, version: APP.version } };
  if (Array.isArray(nova.patchGroups)) {
    // a register, not a link (contract, section 2): a group whose objects are all gone is removed on saving
    const ids = new Set(doc.objects.map((o) => o.id));
    const live = nova.patchGroups.filter((g) => !Array.isArray(g?.cells) || g.cells.some((c) => Array.isArray(c?.objectIds) && c.objectIds.some((id) => ids.has(id))));
    if (live.length !== nova.patchGroups.length) out.patchGroups = live;
  }
  return { ...doc, nova: out };
}

/** The text of the .nsd. */
export function nsdText(doc: StitchDocument): string {
  return `${JSON.stringify(forSaving(doc), null, 2)}\n`;
}

/** The bytes of the .nsd (UTF-8, no byte order mark). */
export function nsdBytes(doc: StitchDocument): Uint8Array {
  return new TextEncoder().encode(nsdText(doc));
}
