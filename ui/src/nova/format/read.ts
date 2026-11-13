// Reading a project (module a): the bytes of a .nsd, .filum or .json become a
// document with a complete nova block, migrated to the current schema, or a
// DamagedFileError naming the file. Reading touches nothing else: a damaged
// file leaves the open design as it was.

import type { NovaDocument, StitchDocument } from "../../types";
import { t } from "../core/i18n";
import { migrate, type RawDoc } from "./migrate";
import { NOVA_SCHEMA, novaDefaults } from "./nova";
import "./texts";

/** Where the design came from: only a .nsd is ever written back in place. */
export type SourceKind = "nsd" | "filum" | "json";

/** The project extensions module a opens. */
export const PROJECT_EXT: readonly SourceKind[] = ["nsd", "filum", "json"];

export interface ReadResult {
  doc: StitchDocument;
  kind: SourceKind;
  /** nova.schemaVersion as found in the file (0: no nova block, a Filum file). */
  fromSchema: number;
  migrated: boolean;
  /** Written by a newer version: shown, never saved over. */
  readOnly: boolean;
  /** Texts for the user, in the current language. */
  warnings: string[];
}

/** «File danneggiato: …» / «Damaged file: …», with the file's name. */
export class DamagedFileError extends Error {
  constructor(
    readonly fileName: string,
    /** What was wrong, for diagnosis (not translated). */
    readonly detail: string,
  ) {
    super(t("a.error.damaged", { name: fileName }));
    this.name = "DamagedFileError";
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** The kind of a file name; anything that is not .filum or .json is read as a .nsd. */
export function kindOf(name: string): SourceKind {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "filum" || ext === "json" ? ext : "nsd";
}

export function readProject(name: string, bytes: Uint8Array): ReadResult {
  const damaged = (detail: string) => new DamagedFileError(name, detail);
  let text: string;
  try {
    // fatal: bytes that are not UTF-8 are damage, not text to guess at
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    throw damaged("not UTF-8 text");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw damaged((e as Error).message);
  }
  if (!isObj(raw) || !Array.isArray(raw.objects)) throw damaged("not a design (no objects list)");

  let fromSchema = 0;
  if ("nova" in raw) {
    const nova = raw.nova;
    if (!isObj(nova)) throw damaged("the nova block is not an object");
    const v = nova.schemaVersion;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0) throw damaged(`nova.schemaVersion is ${JSON.stringify(v)}`);
    fromSchema = v;
  }
  const kind = kindOf(name);

  // newer than this program: shown exactly as it is, and never written over
  if (fromSchema > NOVA_SCHEMA)
    return { doc: raw as unknown as StitchDocument, kind, fromSchema, migrated: false, readOnly: true, warnings: [t("a.warning.newer", { name })] };

  const migrated = fromSchema < NOVA_SCHEMA;
  const doc = migrate(raw as RawDoc, fromSchema) as unknown as StitchDocument;
  // optional fields added since the file was written get their defaults; what is there stays, unknown fields included
  const nova = { ...novaDefaults(), ...doc.nova } as NovaDocument;
  return { doc: { ...doc, nova }, kind, fromSchema, migrated, readOnly: false, warnings: [] };
}
