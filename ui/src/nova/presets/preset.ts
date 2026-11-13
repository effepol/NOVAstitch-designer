// Fabric presets (module e): the file presets/fabric/<id>.json and its checks.
// A preset is app data, read-only, shipped with the program. Its values go
// INTO the objects (contract, module e): satin, fill and running-stitch
// parameters, the overlap between neighbouring fills (FillParams.expand), and
// the structured fields the work sheet (module l) prints. The info sheet is
// text, not a rule.

import type { Fabric, FillParams, RunningParams, SatinParams } from "../../types";

export const PRESET_SCHEMA = 1;

export type Stabilizer = "tear-away" | "cut-away" | "wash-away" | "adhesive";
export type Topping = "none" | "water-soluble-film";
export type NeedlePoint = "normal" | "ballpoint";

export interface FabricPreset {
  schemaVersion: number;
  /** Same as the file name without .json. */
  id: string;
  /** Up by 1 at every change of the values (nova.fabricPreset.rev). */
  rev: number;
  name: { it: string; en: string };
  /** The Filum fabric the engine uses (doc.fabric). */
  base: Fabric;
  /** Stretchy fabric (knits): its own warnings (e.12, e.14). */
  elastic: boolean;
  /** Overlap between neighbouring fills, mm (FillParams.expand): flat hoop, cap frame. */
  overlap: { flat: number; cap: number };
  satin?: Partial<SatinParams>;
  fill?: Partial<FillParams>;
  running?: Partial<RunningParams>;
  /** Contour underlay on satin columns from this width up (mm); narrower columns get none from the preset. */
  satinContourFrom?: number;
  /** Warning thresholds. */
  limits: {
    /** Smallest distance between stitches for No. 40 thread, mm; scaled with the thread's width for the others (e.11). */
    minSpacing: number;
  };
  /** Info sheet (stabiliser, hoop, thread, needle, topping): text, not a rule. */
  info: { it: string; en: string };
  /** Structured fields for the work sheet (module l). */
  stabilizer: { type: Stabilizer; /** g/m² */ weight: number };
  topping: Topping;
  needlePoint: NeedlePoint;
}

export const FABRICS: readonly Fabric[] = ["cotton", "polyester", "denim", "knit", "sheer", "felt", "towel", "cap", "fleece", "pique", "leather", "canvas", "silk"];
const STABILIZERS: readonly Stabilizer[] = ["tear-away", "cut-away", "wash-away", "adhesive"];
const TOPPINGS: readonly Topping[] = ["none", "water-soluble-film"];
const POINTS: readonly NeedlePoint[] = ["normal", "ballpoint"];

type Kind = "number" | "boolean" | "string";
/** The stitch parameters a preset may set, with their type (a misspelt name is refused, not ignored). */
export const PARAMS: Record<"satin" | "fill" | "running", Record<string, Kind>> = {
  satin: {
    spacing: "number",
    pullComp: "number",
    pullCompPct: "number",
    pushComp: "number",
    maxStitchLength: "number",
    shortStitchInset: "number",
    shortStitchDistance: "number",
    centerWalk: "boolean",
    contourUnderlay: "boolean",
    contourInset: "number",
    zigzagUnderlay: "boolean",
    zigzagUnderlaySpacing: "number",
    zigzagUnderlayInset: "number",
    underlayAuto: "boolean",
    underlayStitchLength: "number",
  },
  fill: {
    rowSpacing: "number",
    maxStitchLength: "number",
    staggers: "number",
    pullComp: "number",
    pullCompPct: "number",
    underlay: "boolean",
    underlayAngle: "number",
    underlaySpacing: "number",
    underlayInset: "number",
    underlayStitchLength: "number",
    underlayAuto: "boolean",
    underlayEdge: "boolean",
    underlayCross: "boolean",
    travelLength: "number",
  },
  running: { length: "number", tolerance: "number", repeats: "number", beanRepeats: "number" },
};

/** A preset file that cannot be used: which file, which field, why. */
export class PresetError extends Error {
  constructor(
    readonly file: string,
    readonly field: string,
    readonly reason: "missing" | "invalid" | "unknown",
  ) {
    super(`${file}: ${field} ${reason === "missing" ? "is missing" : reason === "unknown" ? "is not a preset field" : "is not valid"}`);
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => typeof v === "string" && v.trim().length > 0;
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const mm = (v: unknown) => num(v) && (v as number) >= 0;
/** At most 6 decimals (contract, module a: readable numbers in .nsd, presets and user hoops). */
const sixDecimals = (v: number) => Math.abs(v * 1e6 - Math.round(v * 1e6)) < 1e-6 * Math.max(1, Math.abs(v));

const TOP = ["schemaVersion", "id", "rev", "name", "base", "elastic", "overlap", "satin", "fill", "running", "satinContourFrom", "limits", "info", "stabilizer", "topping", "needlePoint"];

/** The preset in `json`, read from `file` (e.g. "cotone.json"); throws a PresetError naming the first bad field. */
export function parsePreset(file: string, json: unknown): FabricPreset {
  const miss = (field: string) => new PresetError(file, field, "missing");
  const bad = (field: string) => new PresetError(file, field, "invalid");
  if (!isObj(json)) throw bad("(file)");
  const p = json;
  for (const k of Object.keys(p)) if (!TOP.includes(k)) throw new PresetError(file, k, "unknown");

  if (p.schemaVersion === undefined) throw miss("schemaVersion");
  if (p.schemaVersion !== PRESET_SCHEMA) throw bad("schemaVersion");
  if (p.id === undefined) throw miss("id");
  if (typeof p.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(p.id) || `${p.id}.json` !== file.split(/[\\/]/).pop()) throw bad("id");
  if (p.rev === undefined) throw miss("rev");
  if (!Number.isInteger(p.rev) || (p.rev as number) < 1) throw bad("rev");
  for (const [field, v] of [["name", p.name], ["info", p.info]] as const) {
    if (v === undefined) throw miss(field);
    if (!isObj(v)) throw bad(field);
    for (const lang of ["it", "en"]) {
      if (v[lang] === undefined) throw miss(`${field}.${lang}`);
      if (!text(v[lang])) throw bad(`${field}.${lang}`);
    }
  }
  if (p.base === undefined) throw miss("base");
  if (!FABRICS.includes(p.base as Fabric)) throw bad("base");
  if (p.elastic === undefined) throw miss("elastic");
  if (typeof p.elastic !== "boolean") throw bad("elastic");
  if (p.overlap === undefined) throw miss("overlap");
  if (!isObj(p.overlap)) throw bad("overlap");
  for (const k of ["flat", "cap"]) {
    if (p.overlap[k] === undefined) throw miss(`overlap.${k}`);
    if (!mm(p.overlap[k])) throw bad(`overlap.${k}`);
  }
  for (const type of ["satin", "fill", "running"] as const) {
    const v = p[type];
    if (v === undefined) continue;
    if (!isObj(v)) throw bad(type);
    for (const [k, x] of Object.entries(v)) {
      const kind = PARAMS[type][k];
      if (!kind) throw new PresetError(file, `${type}.${k}`, "unknown");
      if (k === "expand") throw new PresetError(file, `${type}.${k}`, "unknown");
      if (kind === "number" ? !num(x) : typeof x !== kind) throw bad(`${type}.${k}`);
    }
  }
  if (p.satinContourFrom !== undefined && !mm(p.satinContourFrom)) throw bad("satinContourFrom");
  if (p.limits === undefined) throw miss("limits");
  if (!isObj(p.limits)) throw bad("limits");
  if (p.limits.minSpacing === undefined) throw miss("limits.minSpacing");
  if (!mm(p.limits.minSpacing)) throw bad("limits.minSpacing");
  if (p.stabilizer === undefined) throw miss("stabilizer");
  if (!isObj(p.stabilizer)) throw bad("stabilizer");
  if (p.stabilizer.type === undefined) throw miss("stabilizer.type");
  if (!STABILIZERS.includes(p.stabilizer.type as Stabilizer)) throw bad("stabilizer.type");
  if (p.stabilizer.weight === undefined) throw miss("stabilizer.weight");
  if (!num(p.stabilizer.weight) || (p.stabilizer.weight as number) <= 0) throw bad("stabilizer.weight");
  if (p.topping === undefined) throw miss("topping");
  if (!TOPPINGS.includes(p.topping as Topping)) throw bad("topping");
  if (p.needlePoint === undefined) throw miss("needlePoint");
  if (!POINTS.includes(p.needlePoint as NeedlePoint)) throw bad("needlePoint");

  // readable numbers: at most 6 decimals everywhere
  const numbers = (v: unknown, at: string): void => {
    if (typeof v === "number" && !sixDecimals(v)) throw bad(at);
    if (isObj(v)) for (const [k, x] of Object.entries(v)) numbers(x, at ? `${at}.${k}` : k);
  };
  numbers(p, "");
  return p as unknown as FabricPreset;
}

export interface LoadResult {
  presets: FabricPreset[];
  /** Files refused, each with the field at fault; the others are loaded (e.5). */
  errors: PresetError[];
}

/** Every preset among `files` (file name → text): a refused file does not stop the others. */
export function loadPresets(files: Record<string, string>): LoadResult {
  const presets: FabricPreset[] = [];
  const errors: PresetError[] = [];
  for (const [file, body] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    const name = file.split(/[\\/]/).pop()!;
    try {
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        throw new PresetError(name, "(JSON)", "invalid");
      }
      const p = parsePreset(name, json);
      if (presets.some((x) => x.id === p.id)) throw new PresetError(name, "id", "invalid");
      presets.push(p);
    } catch (e) {
      errors.push(e instanceof PresetError ? e : new PresetError(name, "(file)", "invalid"));
    }
  }
  return { presets, errors };
}
