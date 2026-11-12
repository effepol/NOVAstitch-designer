// Project format hook (module 0, for module a): opening and saving a project
// go through one registered format. Filum's actions call it; without one they
// behave as Filum always did.

import type { StitchDocument } from "../../types";

export interface ProjectRead {
  doc: StitchDocument;
  /** nova.schemaVersion found in the file (0: a Filum file). */
  fromSchema: number;
  migrated: boolean;
  readOnly: boolean;
  /** Texts for the user, already translated. */
  warnings: string[];
}

export interface ProjectFormat {
  /** The module that provides it (named in errors). */
  module: string;
  /** Extensions opened as projects, lower case, without the dot. */
  extensions: string[];
  /** Name of the project filter in the Open dialog (already translated). */
  filterName: () => string;
  /** Throws an Error whose message is shown as it is (e.g. «File danneggiato: …»). */
  read(name: string, bytes: Uint8Array): ProjectRead;
  /** Saves the design (asks where when it must); the path written, or null when cancelled. Throws on failure. */
  save(doc: StitchDocument, opts: { saveAs: boolean }): Promise<string | null>;
}

let current: ProjectFormat | null = null;

/** Register the project format; returns the function that removes it. */
export function registerProjectFormat(f: ProjectFormat): () => void {
  if (current) throw new Error(`Project format from module "${f.module}": module "${current.module}" has registered one already`);
  current = f;
  return () => {
    if (current === f) current = null;
  };
}

export const projectFormat = (): ProjectFormat | null => current;
