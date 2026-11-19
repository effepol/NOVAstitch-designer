// Stitch types of the modules (module 0, for module j): Filum's stitch type
// picker (components/StitchPanel.tsx StylePicker) offers the types a module
// registers (j: foam «Satin su schiuma 3D», layered3d «3D a strati») beside its
// own, marked data-nova; when the object has one of them, the properties panel
// (components/Dock.tsx StitchOptions) shows the module's section instead of
// Filum's. New fields of a Filum type (j: placementInset, freeEdge of the
// appliqué) go into Filum's section of that type through registerStitchFields.
// Texts come from the registering module's catalogs.

import { useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import type { DesignObject, StitchParams } from "../../types";
import type { StitchPatch } from "../../store";

/** What a module's section or fields get: the object shown and how to change it (Filum's own helpers). */
export interface StitchSectionProps {
  o: DesignObject;
  /** The objects the change goes to (the object, or every selected one of its type). */
  targets: string[];
  /** One undo step. */
  up(p: StitchPatch): void;
  /** While dragging: preview, no undo step (call begin() first). */
  live(p: StitchPatch): void;
  begin(): void;
}

export interface StitchTypeEntry {
  /** "<module>.<name>" */
  id: string;
  module: string;
  /** Where the card goes in the picker: with Filum's fills (closed shapes only) or its lines. */
  group: "fill" | "line";
  label(): string;
  title?(): string;
  icon: ReactNode;
  /** The stitch is of this type (checked before Filum's own cards). */
  matches(st: StitchParams): boolean;
  /** The object's stitch once this type is picked (one undo step, Filum's commit). */
  apply(o: DesignObject): StitchParams;
  /** Why the type is not available for this object (null: it is). */
  needs?(o: DesignObject): string | null;
  /** Shown instead of Filum's section for this stitch. */
  Section: ComponentType<StitchSectionProps>;
}

export type FieldsPlace = "placement" | "tackdown" | "cover" | "end";

export interface StitchFieldsEntry {
  /** "<module>.<name>" */
  id: string;
  module: string;
  /** The Filum stitch type whose section gets the fields. */
  type: StitchParams["type"];
  /** Appliqué: which of Filum's steps they go in ("end": after them); other types: at the end. */
  place?: FieldsPlace;
  Fields: ComponentType<StitchSectionProps>;
}

const types = new Map<string, StitchTypeEntry>();
const fields = new Map<string, StitchFieldsEntry>();
const listeners = new Set<() => void>();
let version = 0;
const changed = () => {
  version++;
  for (const fn of [...listeners]) fn();
};

function add<T extends { id: string; module: string }>(map: Map<string, T>, e: T, what: string): () => void {
  if (map.has(e.id)) throw new Error(`${what} "${e.id}" from module "${e.module}" is already registered`);
  map.set(e.id, e);
  changed();
  return () => {
    if (map.get(e.id) === e) {
      map.delete(e.id);
      changed();
    }
  };
}

export const registerStitchType = (e: StitchTypeEntry): (() => void) => add(types, e, "Stitch type");
export const registerStitchFields = (e: StitchFieldsEntry): (() => void) => add(fields, e, "Stitch fields");

export const stitchTypes = (): StitchTypeEntry[] => [...types.values()];

/** The registered type the stitch has, or null (Filum's own). */
export function stitchTypeOf(st: StitchParams): StitchTypeEntry | null {
  for (const e of types.values()) if (e.matches(st)) return e;
  return null;
}

/** The fields registered for a Filum type, in one place (no place given: every place counts as "end"). */
export const stitchFieldsFor = (type: StitchParams["type"], place: FieldsPlace = "end"): StitchFieldsEntry[] =>
  [...fields.values()].filter((f) => f.type === type && (f.place ?? "end") === place);

/** React: render again when types or fields come or go. */
export function useStitchTypes(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
    () => version,
  );
}
