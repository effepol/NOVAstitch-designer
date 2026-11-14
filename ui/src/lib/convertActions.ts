// The Path menu's shape conversions as previewable plans: each builder reads
// the selection and returns what replaces which object; the Convert dialog
// previews a plan on the canvas and applies it as one undo step.
//
// Ink/Stitch counterparts: fill_to_satin, fill_to_stroke, satin_to_stroke,
// stroke_to_satin, zigzag_line_to_satin, stroke_to_lpe_satin, break_apart,
// remove_duplicated_points (lib/extensions/*.py).

import { engine } from "../engine/client";
import type { DesignObject, SatinParams, StitchDocument, StitchParams, SubPath, Vec2 } from "../types";
import { fitPath, flattenSubPath } from "./bezier";
import {
  centreLineToRails,
  DEFAULT_DEDUPE,
  DEFAULT_PATTERN,
  DEFAULT_ZIGZAG,
  duplicateNodes,
  dropNodes,
  patternSatin,
  railPath,
  satinPaths,
  zigzagToSatin,
  type DedupeOptions,
  type PatternOptions,
  type ZigzagOptions,
} from "./convert";
import { defaultStitch, uid } from "./geometry";
import { withParent } from "./groups";
import { pruneGroups } from "./layerRows";
import { connectLines, DEFAULT_CONNECT, type ConnectOptions } from "./connectLines";
import { t, tn } from "../nova/i18n/filum";

export type ConvertId = "fillToSatin" | "fillToStroke" | "satinToStroke" | "satinToRails" | "zigzagToSatin" | "patternSatin" | "breakApart" | "dedupe" | "connectLines";

/** What a conversion does to the document. */
export interface ConvertPlan {
  /** Object id → the objects that take its place (empty: removed; may include itself: kept). */
  replace: Record<string, DesignObject[]>;
  /** Objects selected afterwards. */
  select: string[];
  /** One line for the dialog / toast. */
  summary: string;
}

export type UnderlayPreset = "auto" | "none" | "centre" | "edges" | "full";

export interface FillToSatinOptions {
  /** Start and end at the first and last rung (Ink/Stitch "Start / end at rung"). */
  skipEndSection: boolean;
  pullComp: number;
  underlay: UnderlayPreset;
  /** none: remove fills and rungs · fills · all: keep fills and rungs · unused: keep the parts no rung crosses. */
  keep: "none" | "fills" | "all" | "unused";
}

export interface FillToStrokeOptions {
  /** Dead ends shorter than this are removed (mm). */
  deadEnd: number;
  keepOriginal: boolean;
  /** Bridge the line ends left at cut lines. */
  closeGaps: boolean;
  /** Stitch the lines as running stitch, or as satins of the shape's width. */
  output: "running" | "satin";
}

export interface ConvertOptions {
  fillToSatin: FillToSatinOptions;
  fillToStroke: FillToStrokeOptions;
  satinToStroke: { keepSatin: boolean };
  satinToRails: { width: number };
  zigzagToSatin: ZigzagOptions;
  patternSatin: PatternOptions;
  breakApart: { method: "simple" | "complex"; minArea: number };
  dedupe: DedupeOptions;
  connectLines: ConnectOptions;
}

export const DEFAULT_CONVERT: ConvertOptions = {
  fillToSatin: { skipEndSection: false, pullComp: 0, underlay: "auto", keep: "unused" },
  fillToStroke: { deadEnd: 10, keepOriginal: false, closeGaps: false, output: "running" },
  satinToStroke: { keepSatin: false },
  satinToRails: { width: 3 },
  zigzagToSatin: DEFAULT_ZIGZAG,
  patternSatin: DEFAULT_PATTERN,
  // Ink/Stitch: 20 px² ≈ 1.4 mm²
  breakApart: { method: "simple", minArea: 1.4 },
  dedupe: DEFAULT_DEDUPE,
  connectLines: DEFAULT_CONNECT,
};

export const UNDERLAYS = (): [UnderlayPreset, string, Partial<SatinParams>, string][] => [
  ["auto", t("filum.finestre.auto"), { underlayAuto: true }, t("filum.finestre.chosen_by_the_column_s")],
  ["none", t("filum.finestre.none"), { underlayAuto: false, centerWalk: false, contourUnderlay: false, zigzagUnderlay: false }, t("filum.finestre.no_underlay_thin_columns")],
  ["centre", t("filum.finestre.centre"), { underlayAuto: false, centerWalk: true, contourUnderlay: false, zigzagUnderlay: false }, t("filum.finestre.centre_walk_narrow_columns")],
  ["edges", t("filum.finestre.edges"), { underlayAuto: false, centerWalk: false, contourUnderlay: true, zigzagUnderlay: false }, t("filum.finestre.contour_underlay_crisp_edges")],
  ["full", t("filum.finestre.full"), { underlayAuto: false, centerWalk: false, contourUnderlay: true, zigzagUnderlay: true }, t("filum.finestre.contour_zig_zag_wide_columns")],
];

// ---------------------------------------------------------------------------
// What the selection holds

export const isFillObj = (o: DesignObject) => !o.text && (o.stitch.type === "fill" || o.stitch.type === "none") && o.paths.some((sp) => sp.closed && sp.nodes.length >= 3);
export const openLines = (o: DesignObject) => o.paths.filter((sp) => sp.nodes.length >= 2 && !sp.closed);
/** Lines: running stitch (or unstitched) objects, every sub-path a line. */
export const isLineObj = (o: DesignObject) => !o.text && (o.stitch.type === "running" || o.stitch.type === "manual" || o.stitch.type === "none") && o.paths.some((sp) => sp.nodes.length >= 2);
export const isSatinObj = (o: DesignObject) => !o.text && o.stitch.type === "satin" && o.paths.some((sp) => sp.nodes.length >= 2);
/** Centre-line satins: one line (or one line per sub-path) and a width. */
export const isCentreSatin = (o: DesignObject) => isSatinObj(o) && o.stitch.type === "satin" && (o.stitch.multi || o.paths.filter((sp) => sp.nodes.length >= 2).length === 1);

/** Whether a conversion has something to work on in the selection. */
export function applies(id: ConvertId, sel: DesignObject[]): boolean {
  switch (id) {
    case "fillToSatin":
      return sel.some(isFillObj) && sel.some((o) => !isFillObj(o) && openLines(o).length > 0);
    case "fillToStroke":
    case "breakApart":
      return sel.some(isFillObj);
    case "satinToStroke":
      return sel.some(isSatinObj);
    case "satinToRails":
      return sel.some((o) => isCentreSatin(o) || isLineObj(o));
    case "zigzagToSatin":
      return sel.some((o) => !o.text && openLines(o).some((sp) => sp.nodes.length >= 4));
    case "patternSatin":
      return sel.some((o) => isLineObj(o) || isCentreSatin(o));
    case "dedupe":
      return sel.some((o) => !o.text && o.paths.length > 0);
    case "connectLines":
      return sel.filter(isLineObj).reduce((n, o) => n + openLines(o).length, 0) >= 2;
  }
}

// ---------------------------------------------------------------------------
// Helpers

const ring = (pts: Vec2[]): SubPath => fitPath(pts, 0.02, true, 30, 0.4);
const line = (pts: Vec2[], closed = false): SubPath => fitPath(pts, 0.05, closed, 50, 0.6);

function derived(from: DesignObject, name: string, paths: SubPath[], stitch: StitchParams, group?: string): DesignObject {
  return {
    id: uid(),
    name,
    thread: from.thread,
    visible: true,
    locked: false,
    paths,
    stitch,
    trimAfter: false,
    stopAfter: false,
    ...(group ? { group } : from.group ? { group: from.group } : {}),
  };
}

function satinStitch(from: DesignObject, patch: Partial<SatinParams> = {}): StitchParams {
  const base = from.stitch.type === "satin" ? from.stitch : (defaultStitch("satin") as StitchParams & { type: "satin" });
  return { ...base, multi: false, guides: undefined, swapRails: false, reverse: false, ...patch, type: "satin" };
}

/** Apply a plan to a document. */
export function applyPlan(d: StitchDocument, plan: ConvertPlan): StitchDocument {
  const objects: DesignObject[] = [];
  const known = new Set(d.objects.map((o) => o.group).filter(Boolean));
  let parents = d.groupParents;
  for (const o of d.objects) {
    const r = plan.replace[o.id];
    if (!r) {
      objects.push(o);
      continue;
    }
    objects.push(...r);
    // a new group for the parts sits in the group the source was in
    if (o.group) for (const x of r) if (x.group && !known.has(x.group) && !parents?.[x.group]) parents = withParent(parents, x.group, o.group);
  }
  // groups left with one thing (or nothing) dissolve
  return pruneGroups({ ...d, objects, groupParents: parents });
}

// ---------------------------------------------------------------------------
// The conversions

interface FillToSatinOut {
  satins: { rails: [Vec2[], Vec2[]]; rungs: Vec2[][] }[];
  unused: Vec2[][][];
  used_rungs: number[];
}

/** Ink/Stitch "Fill to satin": the selected fill shapes cut into satins by the selected rung lines. */
export async function planFillToSatin(sel: DesignObject[], o: FillToSatinOptions): Promise<ConvertPlan | string> {
  const fills = sel.filter(isFillObj);
  const rungObjs = sel.filter((x) => !x.text && !fills.includes(x) && openLines(x).length > 0);
  if (!fills.length) return t("filum.finestre.conv_select_a_fill_shape");
  if (!rungObjs.length) return t("filum.finestre.conv_also_select_the_rungs");
  const rungs = rungObjs.flatMap((x) => openLines(x).map((sp) => flattenSubPath(sp, 0.1)));
  const replace: Record<string, DesignObject[]> = {};
  const select: string[] = [];
  let satins = 0;
  let missed = 0;
  const usedAny = new Set<number>();
  const underlay = UNDERLAYS().find((u) => u[0] === o.underlay)?.[2] ?? {};
  for (const f of fills) {
    const r = await engine.convertShapes<FillToSatinOut>("fillToSatin", { paths: f.paths.filter((sp) => sp.closed), rungs, skipEndSection: o.skipEndSection });
    if (!r.satins.length) {
      missed++;
      continue;
    }
    r.used_rungs.forEach((k) => usedAny.add(k));
    const group = r.satins.length > 1 ? uid("g") : undefined;
    const made = r.satins.map((s, i) =>
      derived(
        f,
        r.satins.length > 1 ? t("filum.finestre.conv_name_satin_n", { name: f.name, n: i + 1 }) : t("filum.finestre.conv_name_satin", { name: f.name }),
        [railPath(s.rails[0]), railPath(s.rails[1]), ...s.rungs.map((g): SubPath => ({ closed: false, nodes: g.map((p) => ({ p })) }))],
        satinStitch(f, { ...underlay, pullComp: o.pullComp }),
        group,
      ),
    );
    satins += made.length;
    select.push(...made.map((m) => m.id));
    const rest: DesignObject[] = [];
    if (o.keep === "fills" || o.keep === "all") rest.push(f);
    else if (o.keep === "unused" && r.unused.length) {
      const part = { ...f, id: uid(), name: t("filum.finestre.conv_name_not_converted", { name: f.name }), paths: r.unused.flatMap((poly) => poly.map((rg) => ring(rg))) };
      rest.push(part);
    }
    replace[f.id] = [...rest, ...made];
  }
  if (!satins) return t("filum.finestre.conv_no_rung_crosses");
  if (o.keep !== "all") for (const x of rungObjs) replace[x.id] = [];
  const unusedRungs = rungs.length - usedAny.size;
  return {
    replace,
    select,
    summary: t("filum.finestre.conv_a_from_b", { a: tn("filum.finestre.conv_n_satin", satins), b: tn("filum.finestre.conv_n_fill", fills.length - missed) }) + (missed ? t("filum.finestre.conv_without_rungs", { n: missed }) : "") + (unusedRungs ? t("filum.finestre.conv_rungs_not_crossing", { rungs: tn("filum.finestre.conv_n_rung", unusedRungs) }) : ""),
  };
}

interface CentreLineOut {
  pts: Vec2[];
  widths: number[];
  closed: boolean;
}

/** Ink/Stitch "Fill to stroke": the centre lines of the selected fills (selected lines cut them first). */
export async function planFillToStroke(sel: DesignObject[], o: FillToStrokeOptions): Promise<ConvertPlan | string> {
  const fills = sel.filter(isFillObj);
  if (!fills.length) return t("filum.finestre.conv_select_fill_shapes");
  const cutObjs = sel.filter((x) => !x.text && !fills.includes(x) && openLines(x).length > 0);
  const cutLines = cutObjs.flatMap((x) => openLines(x).map((sp) => flattenSubPath(sp, 0.1)));
  const replace: Record<string, DesignObject[]> = {};
  const select: string[] = [];
  let n = 0;
  for (const f of fills) {
    const lines = await engine.convertShapes<CentreLineOut[]>("centreLines", { paths: f.paths.filter((sp) => sp.closed), cutLines, deadEnd: o.deadEnd, closeGaps: o.closeGaps });
    if (!lines.length) continue;
    const group = lines.length > 1 ? uid("g") : undefined;
    const made = lines.map((l, i) => {
      const name = lines.length > 1 ? t("filum.finestre.conv_name_centre_line_n", { name: f.name, n: i + 1 }) : t("filum.finestre.conv_name_centre_line", { name: f.name });
      const path = line(l.pts, l.closed);
      if (o.output === "satin") {
        const ws = [...l.widths].sort((a, b) => a - b);
        const width = Math.max(0.5, +ws[Math.floor(ws.length / 2)].toFixed(2));
        return derived(f, name, [path], satinStitch(f, { width }), group);
      }
      return derived(f, name, [path], defaultStitch("running"), group);
    });
    n += made.length;
    select.push(...made.map((m) => m.id));
    replace[f.id] = o.keepOriginal ? [f, ...made] : made;
  }
  if (!n) return t("filum.finestre.conv_no_centre_line");
  if (!o.keepOriginal) for (const x of cutObjs) replace[x.id] = [];
  return { replace, select, summary: tn("filum.finestre.conv_n_line", n) + (o.output === "running" && n > 1 ? t("filum.finestre.conv_auto_route_joins") : "") };
}

/** Ink/Stitch "Satin to stroke": a running stitch along the middle of every selected satin. */
export async function planSatinToStroke(sel: DesignObject[], o: { keepSatin: boolean }): Promise<ConvertPlan | string> {
  const satins = sel.filter(isSatinObj);
  if (!satins.length) return t("filum.finestre.conv_select_satin_columns");
  const replace: Record<string, DesignObject[]> = {};
  const select: string[] = [];
  for (const s of satins) {
    let paths: SubPath[];
    if (isCentreSatin(s)) paths = s.paths.filter((sp) => sp.nodes.length >= 2).map((sp) => ({ ...sp, nodes: sp.nodes.map((n) => ({ ...n })) }));
    else {
      const pts = await engine.convertShapes<Vec2[]>("satinCentreLine", { object: s });
      if (pts.length < 2) continue;
      paths = [line(pts)];
    }
    const run = derived(s, t("filum.finestre.conv_name_centre_run", { name: s.name }), paths, defaultStitch("running"));
    select.push(run.id);
    replace[s.id] = o.keepSatin ? [run, s] : [run];
  }
  if (!select.length) return t("filum.finestre.conv_no_usable_rails");
  return { replace, select, summary: t("filum.finestre.conv_along_satin_centre", { lines: tn("filum.finestre.conv_n_running_line", select.length) }) + (o.keepSatin ? t("filum.finestre.conv_satins_kept") : "") };
}

/** Ink/Stitch "Stroke to satin": centre-line satins (and lines) as two editable rails with rungs. */
export async function planSatinToRails(sel: DesignObject[], o: { width: number }): Promise<ConvertPlan | string> {
  const objs = sel.filter((x) => isCentreSatin(x) || isLineObj(x));
  if (!objs.length) return t("filum.finestre.conv_select_centre_line_satins");
  const replace: Record<string, DesignObject[]> = {};
  const select: string[] = [];
  for (const x of objs) {
    const width = x.stitch.type === "satin" ? x.stitch.width : o.width;
    const subs = x.paths.filter((sp) => sp.nodes.length >= 2);
    const made: DesignObject[] = [];
    subs.forEach((sp, i) => {
      const r = centreLineToRails(sp, width);
      if (!r) return;
      made.push(derived(x, subs.length > 1 ? `${x.name} ${i + 1}` : x.name, satinPaths(r), satinStitch(x, { width })));
    });
    if (!made.length) continue;
    select.push(...made.map((m) => m.id));
    replace[x.id] = made;
  }
  if (!select.length) return t("filum.finestre.conv_nothing_to_convert");
  return { replace, select, summary: t("filum.finestre.conv_with_editable_rails", { satins: tn("filum.finestre.conv_n_satin", select.length) }) };
}

/** Ink/Stitch "Zig-zag line to satin". */
export async function planZigzagToSatin(sel: DesignObject[], o: ZigzagOptions): Promise<ConvertPlan | string> {
  const objs = sel.filter((x) => !x.text && openLines(x).some((sp) => sp.nodes.length >= 4));
  if (!objs.length) return t("filum.finestre.conv_select_zigzag_line");
  const replace: Record<string, DesignObject[]> = {};
  const select: string[] = [];
  for (const x of objs) {
    const lines = openLines(x).filter((sp) => sp.nodes.length >= 4);
    const made: DesignObject[] = [];
    lines.forEach((sp, i) => {
      const paths = zigzagToSatin(sp.nodes.map((n) => n.p), o);
      if (paths) made.push(derived(x, lines.length > 1 ? `${x.name} ${i + 1}` : t("filum.finestre.conv_name_satin", { name: x.name }), paths, satinStitch(x)));
    });
    if (!made.length) continue;
    select.push(...made.map((m) => m.id));
    replace[x.id] = made;
  }
  if (!select.length) return t("filum.finestre.conv_too_few_points");
  return { replace, select, summary: t("filum.finestre.conv_from_zigzag", { satins: tn("filum.finestre.conv_n_satin", select.length) }) };
}

/** Ink/Stitch "Stroke to live path effect satin", baked: a patterned satin along every selected line. */
export async function planPatternSatin(sel: DesignObject[], o: PatternOptions): Promise<ConvertPlan | string> {
  const objs = sel.filter((x) => isLineObj(x) || isCentreSatin(x));
  if (!objs.length) return t("filum.finestre.conv_select_lines_or_satins");
  const replace: Record<string, DesignObject[]> = {};
  const select: string[] = [];
  for (const x of objs) {
    const subs = x.paths.filter((sp) => sp.nodes.length >= 2);
    const made: DesignObject[] = [];
    subs.forEach((sp, i) => {
      const paths = patternSatin(sp, o);
      if (paths) made.push(derived(x, subs.length > 1 ? `${x.name} ${i + 1}` : `${x.name} (${o.pattern})`, paths, satinStitch(x, { width: o.maxWidth })));
    });
    if (!made.length) continue;
    select.push(...made.map((m) => m.id));
    replace[x.id] = made;
  }
  if (!select.length) return t("filum.finestre.conv_lines_shorter_than_repeat");
  return { replace, select, summary: tn("filum.finestre.conv_n_patterned_satin", select.length) };
}

type BreakOut = { kind: "valid" } | { kind: "removed" } | { kind: "parts"; parts: { rings: Vec2[][]; source: (number | null)[] }[] };

/** Ink/Stitch "Break apart fill objects": repair and split the selected fills. */
export async function planBreakApart(sel: DesignObject[], o: { method: "simple" | "complex"; minArea: number }): Promise<ConvertPlan | string> {
  // a gradient's, tartan's or blend's layers share one shape: split together they'd fall apart
  const fills = sel.filter((x) => isFillObj(x) && !(x.stitch.type === "fill" && (x.stitch.gradient || x.stitch.tartan || x.stitch.ramp?.group)));
  if (!fills.length) return sel.some(isFillObj) ? t("filum.finestre.conv_cant_break_apart") : t("filum.finestre.conv_select_fill_shapes");
  const replace: Record<string, DesignObject[]> = {};
  const select: string[] = [];
  let valid = 0;
  let removed = 0;
  let parts = 0;
  for (const f of fills) {
    const closed = f.paths.filter((sp) => sp.closed && sp.nodes.length >= 3);
    const r = await engine.convertShapes<BreakOut>("breakApart", { paths: closed, method: o.method, minArea: o.minArea });
    if (r.kind === "valid") {
      valid++;
      select.push(f.id);
      continue;
    }
    if (r.kind === "removed") {
      removed++;
      replace[f.id] = [];
      continue;
    }
    // smaller parts sew last (on top), as in Ink/Stitch
    const made = r.parts.map((p, i) => ({
      ...f,
      id: uid(),
      name: r.parts.length > 1 ? `${f.name} ${i + 1}` : f.name,
      paths: p.rings.map((rg, k) => (p.source[k] != null ? closed[p.source[k]!] : ring(rg))),
      start: undefined,
      end: undefined,
      // each part is a shape of its own (a clone's link would rebuild it whole)
      clone: undefined,
    }));
    parts += made.length;
    select.push(...made.map((m) => m.id));
    replace[f.id] = made;
  }
  if (!parts && !removed) return tn("filum.finestre.conv_nothing_to_repair", valid);
  return {
    replace,
    select,
    summary: [parts ? tn("filum.finestre.conv_n_shape", parts) : "", removed ? t("filum.finestre.conv_too_small_removed", { n: removed }) : "", valid ? t("filum.finestre.conv_already_valid", { n: valid }) : ""].filter(Boolean).join(" · "),
  };
}

/** Ink/Stitch "Remove duplicated points". Two-rail satins drop only node pairs, so their rungs stay matched. */
export async function planDedupe(sel: DesignObject[], o: DedupeOptions): Promise<ConvertPlan | string> {
  const objs = sel.filter((x) => !x.text);
  if (!objs.length) return t("filum.finestre.conv_select_shapes");
  const replace: Record<string, DesignObject[]> = {};
  let removed = 0;
  for (const x of objs) {
    let paths = x.paths;
    const rails = x.stitch.type === "satin" && !x.stitch.multi && x.paths.length === 2 && x.paths[0].nodes.length === x.paths[1].nodes.length;
    if (rails) {
      const [a, b] = x.paths.map((sp) => new Set(duplicateNodes(sp, o)));
      const both = [...a].filter((i) => b.has(i));
      if (both.length && x.paths[0].nodes.length - both.length >= 2) {
        paths = x.paths.map((sp) => dropNodes(sp, both));
        removed += both.length * 2;
      }
    } else {
      paths = x.paths.map((sp) => {
        const drop = duplicateNodes(sp, o);
        if (!drop.length || sp.nodes.length - drop.length < 2) return sp;
        removed += drop.length;
        return dropNodes(sp, drop);
      });
    }
    if (paths !== x.paths && paths.some((sp, i) => sp !== x.paths[i])) replace[x.id] = [{ ...x, paths }];
  }
  if (!removed) return t("filum.finestre.conv_no_duplicated_points");
  return { replace, select: objs.map((x) => x.id), summary: t("filum.finestre.conv_points_removed", { points: tn("filum.finestre.conv_n_duplicated_point", removed) }) };
}

/**
 * Connect lines: the selected line pieces of one thread and stitch become as
 * few continuous lines as possible, in the first of them (see lib/connectLines.ts).
 */
export function planConnectLines(sel: DesignObject[], o: ConnectOptions): ConvertPlan | string {
  const lines = sel.filter((x) => isLineObj(x) && !x.clone && !x.locked);
  if (lines.reduce((n, x) => n + openLines(x).length, 0) < 2) return t("filum.finestre.conv_select_line_pieces");
  // lines of one thread and one stitch are connected together
  const groups = new Map<string, DesignObject[]>();
  for (const x of lines) {
    const k = `${x.thread}|${JSON.stringify(x.stitch)}`;
    groups.set(k, [...(groups.get(k) ?? []), x]);
  }
  const replace: Record<string, DesignObject[]> = {};
  const select: string[] = [];
  let pieces = 0;
  let made = 0;
  let bridged = 0;
  let doubled = 0;
  for (const objs of groups.values()) {
    const r = connectLines(objs.flatMap((x) => x.paths), o);
    pieces += r.pieces;
    made += r.lines;
    bridged += r.bridged;
    doubled += r.doubled;
    // one object already as connected as it gets: left as it is
    if (objs.length === 1 && r.lines === objs[0].paths.filter((sp) => sp.nodes.length >= 2).length && !r.doubled && !r.bridged) continue;
    const [first, ...rest] = objs;
    replace[first.id] = [{ ...first, paths: r.paths, start: first.start, end: undefined }];
    for (const x of rest) replace[x.id] = [];
    select.push(first.id);
  }
  if (!select.length) return t("filum.finestre.conv_lines_dont_meet");
  const extra = [bridged ? t("filum.finestre.conv_gaps_bridged", { gaps: tn("filum.finestre.conv_n_gap", bridged) }) : "", doubled ? t("filum.finestre.conv_pieces_left_out", { pieces: tn("filum.finestre.conv_n_doubled_piece", doubled) }) : ""].filter(Boolean).join(", ");
  return { replace, select, summary: t("filum.finestre.conv_pieces_to_lines", { pieces: tn("filum.finestre.conv_n_piece", pieces), lines: tn("filum.finestre.conv_n_line", made) }) + (extra ? ` · ${extra}` : "") };
}

export function planConversion(id: ConvertId, sel: DesignObject[], opts: ConvertOptions): Promise<ConvertPlan | string> {
  switch (id) {
    case "fillToSatin":
      return planFillToSatin(sel, opts.fillToSatin);
    case "fillToStroke":
      return planFillToStroke(sel, opts.fillToStroke);
    case "satinToStroke":
      return planSatinToStroke(sel, opts.satinToStroke);
    case "satinToRails":
      return planSatinToRails(sel, opts.satinToRails);
    case "zigzagToSatin":
      return planZigzagToSatin(sel, opts.zigzagToSatin);
    case "patternSatin":
      return planPatternSatin(sel, opts.patternSatin);
    case "breakApart":
      return planBreakApart(sel, opts.breakApart);
    case "dedupe":
      return planDedupe(sel, opts.dedupe);
    case "connectLines":
      return Promise.resolve(planConnectLines(sel, opts.connectLines));
  }
}
