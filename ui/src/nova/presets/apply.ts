// The preset rule (contract, module e): the preset writes its values inside
// the objects. Every new object starts from the preset in force, with the
// fabric calibration's measured values on top (Architect, 13/11: the user's
// measurement on their own fabric wins). Changing preset puts the new values
// on every parameter of every object that is not in nova.edited; the
// parameters changed by hand stay as they are. No geometry is changed.

import type { DesignObject, FillParams, RunningParams, SatinParams, StitchDocument, StitchParams } from "../../types";
import { INK_RUNNING, INK_SATIN, INK_TATAMI } from "../../lib/inkDefaults";
import { calibratedDefaults } from "../../lib/calibration";
import type { FabricPreset } from "./preset";
import { presetOf } from "./registry";
import { round6 } from "./round";

type Managed = "satin" | "fill" | "running";
type Values = Record<string, unknown>;

/** Filum's own values for new objects, without calibration (what a parameter goes back to when no preset sets it). */
const BASE: Record<Managed, Values> = {
  satin: { ...INK_SATIN },
  fill: { ...INK_TATAMI, expand: 0 },
  running: { ...INK_RUNNING },
};

const managed = (s: StitchParams): Managed | null => (s.type === "satin" || s.type === "fill" || s.type === "running" ? s.type : null);
/** The preset's fill values apply to tatami; the overlap applies to every fill. */
const tatamiLike = (s: StitchParams) => s.type === "fill" && (s.method ?? "tatami") === "tatami";

/** The parameter names (without "stitch.") a preset sets on an object of this stitch. */
function keysOf(p: FabricPreset | null, s: StitchParams): string[] {
  if (!p) return [];
  switch (managed(s)) {
    case "satin":
      return [...Object.keys(p.satin ?? {}), ...(p.satinContourFrom !== undefined ? ["contourUnderlay"] : [])];
    case "fill":
      return [...(tatamiLike(s) ? Object.keys(p.fill ?? {}) : []), "expand"];
    case "running":
      return Object.keys(p.running ?? {});
    default:
      return [];
  }
}

/** What the preset gives this object's stitch (by its width for the satin contour underlay, by the hoop for the overlap). */
export function presetValuesFor(p: FabricPreset | null, s: StitchParams, hoopKind: "flat" | "cap" = "flat"): Values {
  if (!p) return {};
  switch (managed(s)) {
    case "satin": {
      const out: Values = { ...p.satin };
      if (p.satinContourFrom !== undefined) out.contourUnderlay = (s as SatinParams).width >= p.satinContourFrom;
      return out;
    }
    case "fill":
      return { ...(tatamiLike(s) ? p.fill : {}), expand: hoopKind === "cap" ? p.overlap.cap : p.overlap.flat };
    case "running":
      return { ...p.running };
    default:
      return {};
  }
}

const hoopKindOf = (doc: StitchDocument) => doc.nova?.hoopKind ?? "flat";
const num = (v: unknown) => (typeof v === "number" ? round6(v) : v);

/** The value a parameter takes from a preset: the preset's, else Filum's (undefined: left out, the engine's default). */
function valueFor(p: FabricPreset | null, s: StitchParams, key: string, hoopKind: "flat" | "cap"): unknown {
  const v = presetValuesFor(p, s, hoopKind);
  const type = managed(s);
  return num(key in v ? v[key] : type ? BASE[type][key] : undefined);
}

/** `s` with `key` set to `value` (left out when undefined); the same object when nothing changes. */
function withValue(s: StitchParams, key: string, value: unknown): StitchParams {
  const r = s as unknown as Values;
  if (r[key] === value && (value !== undefined || !(key in r))) return s;
  const next = { ...r };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next as unknown as StitchParams;
}

export interface ApplyResult {
  doc: StitchDocument;
  changedObjects: string[];
  /** Parameters left alone because they are in nova.edited, per object. */
  skippedParams: { id: string; params: string[] }[];
}

/** `doc` with `next` in force instead of `prev`: the input itself when nothing changes. */
export function applyPreset(doc: StitchDocument, next: FabricPreset, prev: FabricPreset | null = presetOf(doc)): ApplyResult {
  const hoopKind = hoopKindOf(doc);
  const changedObjects: string[] = [];
  const skippedParams: ApplyResult["skippedParams"] = [];
  const objects = doc.objects.map((o) => {
    const keys = [...new Set([...keysOf(prev, o.stitch), ...keysOf(next, o.stitch)])];
    if (!keys.length) return o;
    const edited = o.nova?.edited ?? [];
    let s = o.stitch;
    const skipped: string[] = [];
    for (const k of keys) {
      if (edited.includes(`stitch.${k}`)) skipped.push(`stitch.${k}`);
      else s = withValue(s, k, valueFor(next, s, k, hoopKind));
    }
    if (skipped.length) skippedParams.push({ id: o.id, params: skipped });
    if (s === o.stitch) return o;
    changedObjects.push(o.id);
    return { ...o, stitch: s };
  });
  const same = doc.fabric === next.base && doc.nova?.fabricPreset?.id === next.id && doc.nova?.fabricPreset?.rev === next.rev && !changedObjects.length;
  if (same) return { doc, changedObjects, skippedParams };
  return {
    doc: { ...doc, fabric: next.base, objects: changedObjects.length ? objects : doc.objects, nova: { schemaVersion: 1, ...doc.nova, fabricPreset: { id: next.id, rev: next.rev } } },
    changedObjects,
    skippedParams,
  };
}

/**
 * e.param.reset: the parameter leaves nova.edited and takes the value of the
 * preset in force again (Filum's when the preset does not set it). A
 * parameter no preset manages (ties, a fill method…) only leaves nova.edited.
 */
export function resetParam(doc: StitchDocument, id: string, param: string, p: FabricPreset | null = presetOf(doc)): StitchDocument {
  const i = doc.objects.findIndex((o) => o.id === id);
  if (i < 0) return doc;
  const o = doc.objects[i];
  const edited = o.nova?.edited ?? [];
  let next: DesignObject = o;
  if (edited.includes(param)) next = { ...o, nova: { ...o.nova, edited: edited.filter((x) => x !== param) } };
  const key = param.startsWith("stitch.") ? param.slice(7) : null;
  if (key && p && keysOf(p, o.stitch).includes(key)) {
    const s = withValue(o.stitch, key, valueFor(p, o.stitch, key, hoopKindOf(doc)));
    if (s !== o.stitch) next = { ...next, stitch: s };
  }
  if (next === o) return doc;
  const objects = [...doc.objects];
  objects[i] = next;
  return { ...doc, objects };
}

export interface NewObjectDefaults {
  satin?: Partial<SatinParams>;
  fill?: Partial<FillParams>;
  running?: Partial<RunningParams>;
}

/**
 * What new objects start from in `doc`: the preset in force, then the fabric
 * calibration's values on top (lib/calibration.ts; `calibrated` replaces it in
 * tests). Without a preset: the calibration only, as in Filum (e.8).
 */
export function newObjectDefaults(doc: StitchDocument, calibrated: { satin?: Partial<SatinParams>; fill?: Partial<FillParams> } = calibratedDefaults(doc.fabric)): NewObjectDefaults {
  const p = presetOf(doc);
  const hk = hoopKindOf(doc);
  const satin = presetValuesFor(p, { type: "satin", ...INK_SATIN, width: 3 } as StitchParams, hk) as Partial<SatinParams>;
  const fill = presetValuesFor(p, { type: "fill", method: "tatami" } as StitchParams, hk) as Partial<FillParams>;
  const running = presetValuesFor(p, { type: "running" } as StitchParams, hk) as Partial<RunningParams>;
  const out: NewObjectDefaults = {};
  if (Object.keys(satin).length || calibrated.satin) out.satin = { ...satin, ...calibrated.satin };
  if (Object.keys(fill).length || calibrated.fill) out.fill = { ...fill, ...calibrated.fill };
  if (Object.keys(running).length) out.running = running;
  return out;
}
