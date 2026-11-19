// Module g: the lesson format (contract «g — Apprentice Mode»; public schema
// lesson.schema.json). A lesson is a folder: lesson.json and, if it says so, its
// starting design (.nsd, or .filum). Conditions are declarative, never code.
// A lesson the validator refuses gets a message naming the folder, the step and
// the mistake; it never stops the other lessons.

import { t } from "../core/i18n";
import "./texts";

export type Lang = "it" | "en";
export type Text = Record<Lang, string>;
export const LESSON_PATHS = ["theory", "vector", "image", "tips"] as const;
export const LESSON_MODES = ["assisted", "studio"] as const;
export const VIEW_MODES = ["vector", "stitch", "realistic"] as const;
export const PLAN_MEASURES = ["stitches", "colorChanges", "trims"] as const;
export const START_EXT = ["nsd", "filum"] as const;

/** {min, max}: both included; one of them may be left out. */
export interface Range {
  min?: number;
  max?: number;
}

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  /** None of them holds. */
  | { not: Condition[] }
  | { exists: { type: string; method?: string; param?: Record<string, Range>; count?: Range | number } }
  | { plan: Partial<Record<(typeof PLAN_MEASURES)[number], Range>> }
  | { view: { mode?: (typeof VIEW_MODES)[number]; zoom?: Range } }
  | { selection: { count: Range | number } };

export interface Step {
  id: string;
  text: Text;
  highlight?: string | { object: string };
  waitFor?: string;
  check?: Condition;
  hint: Text;
  reset: "start" | "step";
}

export interface Lesson {
  id: string;
  rev: number;
  path: (typeof LESSON_PATHS)[number];
  title: Text;
  modes: (typeof LESSON_MODES)[number][];
  startDesign?: string;
  steps: Step[];
}

/** A lesson ready to run: its file, and the text of its starting design. */
export interface LoadedLesson extends Omit<Lesson, "startDesign"> {
  startDesign?: { name: string; text: string };
  /** Where it came from: "builtin" (in the program) or "user" (the app's lessons folder). */
  source?: string;
}

export interface LessonError {
  folder: string;
  message: string;
}

/** Lesson folders: folder name → file name → text. */
export type LessonFiles = Record<string, Record<string, string>>;

type Result = { ok: true; lesson: Lesson } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const ID = /^[a-z0-9][a-z0-9-]*$/;
const STEP_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const EVENT = /^[a-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_-]+)+$/;
const ANCHOR = /^[a-z0-9]+\.[A-Za-z0-9_.-]+$/;
const TYPE = /^[a-z][A-Za-z0-9]*$/;
const NAME = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/;

/** Check a lesson (already parsed from JSON). `anchors`: every anchor the modules declare. */
export function parseLesson(raw: unknown, ctx: { anchors: ReadonlySet<string>; folder: string }): Result {
  const errors: string[] = [];
  const err = (key: string, vars: Record<string, string | number> = {}): void => void errors.push(t(`g.err.${key}`, vars));
  const at = (where: string) => (where ? where : t("g.err.atLesson"));

  const keys = (o: Record<string, unknown>, allowed: string[], where: string) => {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) err("unknownKey", { key: k, where: at(where) });
  };
  const text = (v: unknown, field: string, where: string) => {
    if (!isObj(v) || Object.keys(v).some((k) => k !== "it" && k !== "en")) return err("text", { field, where: at(where) });
    for (const l of ["it", "en"]) if (typeof v[l] !== "string" || !(v[l] as string).trim()) err("textLang", { field, lang: l, where: at(where) });
  };
  const range = (v: unknown, field: string, where: string, number = false) => {
    if (number && typeof v === "number" && Number.isFinite(v)) return;
    if (!isObj(v) || !Object.keys(v).length || Object.keys(v).some((k) => k !== "min" && k !== "max")) return err("range", { field, where });
    for (const k of ["min", "max"]) if (k in v && (typeof v[k] !== "number" || !Number.isFinite(v[k]))) return err("range", { field, where });
    if (typeof v.min === "number" && typeof v.max === "number" && v.min > v.max) err("rangeOrder", { field, where });
  };

  const condition = (c: unknown, where: string): void => {
    if (!isObj(c)) return err("condition", { where });
    const kinds = Object.keys(c);
    if (kinds.length !== 1) return err("conditionOne", { found: kinds.join(", ") || "—", where });
    const kind = kinds[0];
    const v = c[kind];
    switch (kind) {
      case "all":
      case "any":
      case "not":
        if (!Array.isArray(v) || !v.length) return err("conditionList", { kind, where });
        v.forEach((x) => condition(x, where));
        return;
      case "exists": {
        if (!isObj(v)) return err("condition", { where });
        keys(v, ["type", "method", "param", "count"], `${where} › exists`);
        if (typeof v.type !== "string" || !TYPE.test(v.type)) err("existsType", { where });
        if ("method" in v && (typeof v.method !== "string" || !v.method)) err("existsMethod", { where });
        if ("param" in v) {
          if (!isObj(v.param) || !Object.keys(v.param).length) err("existsParam", { where });
          else for (const [name, r] of Object.entries(v.param)) NAME.test(name) ? range(r, name, where) : err("existsParam", { where });
        }
        if ("count" in v) range(v.count, "count", where, true);
        return;
      }
      case "plan":
        if (!isObj(v) || !Object.keys(v).length) return err("plan", { where });
        for (const [m, r] of Object.entries(v)) (PLAN_MEASURES as readonly string[]).includes(m) ? range(r, m, where) : err("planMeasure", { measure: m, where });
        return;
      case "view":
        if (!isObj(v) || !Object.keys(v).length) return err("view", { where });
        keys(v, ["mode", "zoom"], `${where} › view`);
        if ("mode" in v && !(VIEW_MODES as readonly unknown[]).includes(v.mode)) err("viewMode", { mode: String(v.mode), where });
        if ("zoom" in v) range(v.zoom, "zoom", where);
        return;
      case "selection":
        if (!isObj(v)) return err("condition", { where });
        keys(v, ["count"], `${where} › selection`);
        if (!("count" in v)) return err("selection", { where });
        range(v.count, "count", where, true);
        return;
      default:
        err("conditionKind", { kind, where });
    }
  };

  if (!isObj(raw)) return { ok: false, errors: [t("g.err.notObject")] };
  keys(raw, ["id", "rev", "path", "title", "modes", "startDesign", "steps"], "");
  if (typeof raw.id !== "string" || !ID.test(raw.id)) err("id");
  else if (raw.id !== ctx.folder) err("folder", { id: raw.id, folder: ctx.folder });
  if (!Number.isInteger(raw.rev) || (raw.rev as number) < 1) err("rev");
  if (!(LESSON_PATHS as readonly unknown[]).includes(raw.path)) err("path", { path: String(raw.path) });
  text(raw.title, "title", "");
  if (!Array.isArray(raw.modes) || !raw.modes.length || raw.modes.some((m) => !(LESSON_MODES as readonly unknown[]).includes(m)) || new Set(raw.modes).size !== raw.modes.length)
    err("modes");
  if ("startDesign" in raw) {
    const s = raw.startDesign;
    const ext = typeof s === "string" ? s.split(".").pop()?.toLowerCase() : "";
    if (typeof s !== "string" || !/^[A-Za-z0-9][A-Za-z0-9 _.-]*$/.test(s) || s.includes("..") || !(START_EXT as readonly string[]).includes(ext ?? "")) err("startDesign");
  }
  if (!Array.isArray(raw.steps) || !raw.steps.length) err("steps");
  else {
    const seen = new Set<string>();
    raw.steps.forEach((s, i) => {
      const where = t("g.err.atStep", { n: i + 1, id: isObj(s) && typeof s.id === "string" ? s.id : "?" });
      if (!isObj(s)) return err("step", { where });
      keys(s, ["id", "text", "highlight", "waitFor", "check", "hint", "reset"], where);
      if (typeof s.id !== "string" || !STEP_ID.test(s.id)) err("stepId", { where });
      else if (seen.has(s.id)) err("stepIdTwice", { id: s.id });
      else seen.add(s.id);
      text(s.text, "text", where);
      text(s.hint, "hint", where);
      if (s.reset !== "start" && s.reset !== "step") err("reset", { where });
      if ("highlight" in s) {
        const h = s.highlight;
        if (typeof h === "string") {
          if (!ANCHOR.test(h) || !ctx.anchors.has(h)) err("anchor", { anchor: h, where });
        } else if (!isObj(h) || Object.keys(h).length !== 1 || typeof h.object !== "string" || !h.object) err("highlight", { where });
      }
      if ("waitFor" in s && (typeof s.waitFor !== "string" || !EVENT.test(s.waitFor))) err("waitFor", { event: String(s.waitFor), where });
      if ("check" in s) condition(s.check, where);
    });
  }
  return errors.length ? { ok: false, errors } : { ok: true, lesson: raw as unknown as Lesson };
}

/** Read lesson folders: the accepted lessons, and one error per refused folder (it names the folder). */
export function loadLessons(files: LessonFiles, anchors: ReadonlySet<string>, source?: string): { lessons: LoadedLesson[]; errors: LessonError[] } {
  const lessons: LoadedLesson[] = [];
  const errors: LessonError[] = [];
  for (const folder of Object.keys(files).sort()) {
    const refuse = (why: string[]) => errors.push({ folder, message: t("g.err.refused", { folder, why: why.join(" · ") }) });
    const dir = files[folder];
    const text = dir["lesson.json"];
    if (text === undefined) {
      refuse([t("g.err.noFile")]);
      continue;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      refuse([t("g.err.json", { why: (e as Error).message })]);
      continue;
    }
    const r = parseLesson(raw, { anchors, folder });
    if (!r.ok) {
      refuse(r.errors);
      continue;
    }
    const { startDesign, ...rest } = r.lesson;
    let start: LoadedLesson["startDesign"];
    if (startDesign) {
      const body = dir[startDesign];
      if (body === undefined) {
        refuse([t("g.err.startMissing", { name: startDesign })]);
        continue;
      }
      // the objects the steps point at must be in the starting design
      let ids: Set<string>;
      try {
        const d = JSON.parse(body);
        ids = new Set(Array.isArray(d?.objects) ? d.objects.map((o: { id?: unknown }) => String(o?.id)) : []);
      } catch (e) {
        refuse([t("g.err.startJson", { name: startDesign, why: (e as Error).message })]);
        continue;
      }
      const missing = rest.steps.flatMap((s) => (typeof s.highlight === "object" && !ids.has(s.highlight.object) ? [s.highlight.object] : []));
      if (missing.length) {
        refuse(missing.map((id) => t("g.err.objectMissing", { id, name: startDesign })));
        continue;
      }
      start = { name: startDesign, text: body };
    } else {
      const objs = rest.steps.flatMap((s) => (typeof s.highlight === "object" ? [s.highlight.object] : []));
      if (objs.length) {
        refuse(objs.map((id) => t("g.err.objectMissing", { id, name: "—" })));
        continue;
      }
    }
    lessons.push({ ...rest, ...(start ? { startDesign: start } : {}), ...(source ? { source } : {}) });
  }
  return { lessons, errors };
}
