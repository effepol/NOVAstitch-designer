// Migrations (contract, section 2): a chain v0 → v1 → …, each one a pure function
// from the raw JSON of one version to the next. Unknown fields are always kept.
// A file newer than the program is never migrated: it opens read-only.

import { NOVA_SCHEMA, novaDefaults } from "./nova";

/** The raw JSON of a design, as read from the file. */
export type RawDoc = Record<string, unknown>;

/** MIGRATIONS[n] takes a version n document to version n + 1. */
export const MIGRATIONS: ((doc: RawDoc) => RawDoc)[] = [
  // v0 → v1: a Filum design (no nova block) gets nova with its defaults; the objects stay as they are
  (doc) => ({ ...doc, nova: novaDefaults() }),
];

/** From version `from` to the current one; a current document comes back as it is. */
export function migrate(doc: RawDoc, from: number): RawDoc {
  if (from > NOVA_SCHEMA) throw new Error(`schema ${from} is newer than ${NOVA_SCHEMA}: open it read-only`);
  let out = doc;
  for (let v = from; v < NOVA_SCHEMA; v++) out = MIGRATIONS[v](out);
  return out;
}
