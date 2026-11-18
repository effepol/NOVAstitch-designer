// Module m — «Satin a due binari»: the user clicks the two rails in turn
// (1 = S1, 2 = D1, 3 = S2, 4 = D2 …). Left click = straight node (corner),
// right click = curved node (Bézier, handles worked out from the neighbouring
// points, to be retouched later with the node tool). Enter makes the satin,
// Esc gives up. The result is an ordinary two-rail satin of Filum: two open
// rails with as many nodes, each pair of nodes a rung (lib/nodeOps railMap).
//
// Everything here is pure: the click sequence (draftStep), the preview marks
// (previewOf) and the command's geometry (satinFromClicks). The canvas tool
// that feeds the clicks comes with module 0's drawing tool registry.

import type { DesignObject, PathNode, SatinParams, StitchDocument, StitchParams, SubPath, Thread, Vec2 } from "../../types";
import { defaultStitch, uid } from "../../lib/geometry";
import { newObjectDefaults } from "../presets/apply";
import { t } from "../core/i18n";
import "./texts";

/** One click: where, and whether it makes a curved node (right button). */
export interface Click {
  p: Vec2;
  curved?: boolean;
}

/** Params of m.satin.fromClicks: the clicks of rail 1 (S1, S2 …) and rail 2 (D1, D2 …). */
export interface FromClicksParams {
  left: (Click | Vec2)[];
  right: (Click | Vec2)[];
  /** Thread of the new satin (the tool passes the active one); default the design's first. */
  thread?: string;
}

export interface TwoRailDraft {
  clicks: Click[];
}

export type DraftEvent = { type: "click"; p: Vec2; button: "left" | "right" } | { type: "enter" } | { type: "escape" };

export interface DraftResult {
  /** The drawing still going on, or null when it ended (made or given up). */
  draft: TwoRailDraft | null;
  /** Params for runCommand("m.satin.fromClicks", …) when Enter made a satin. */
  create?: FromClicksParams;
  /** i18n key of a warning to show. */
  warning?: "m.twoRails.oddDropped" | "m.twoRails.tooFew";
}

export const emptyDraft = (): TwoRailDraft => ({ clicks: [] });

/** Rail 1 takes the odd clicks (1st, 3rd …), rail 2 the even ones; an unpaired last click is dropped. */
export function pairClicks(clicks: Click[]): { left: Click[]; right: Click[]; dropped: Click | null } {
  const n = clicks.length - (clicks.length % 2);
  return {
    left: clicks.slice(0, n).filter((_, i) => i % 2 === 0),
    right: clicks.slice(0, n).filter((_, i) => i % 2 === 1),
    dropped: n < clicks.length ? clicks[n] : null,
  };
}

/** One step of the tool: a click adds a point, Enter makes the satin, Esc gives up. */
export function draftStep(draft: TwoRailDraft | null, ev: DraftEvent): DraftResult {
  const d = draft ?? emptyDraft();
  if (ev.type === "escape") return { draft: null };
  if (ev.type === "click") return { draft: { clicks: [...d.clicks, { p: ev.p, ...(ev.button === "right" ? { curved: true } : {}) }] } };
  const { left, right, dropped } = pairClicks(d.clicks);
  if (left.length < 2) return { draft: d, warning: "m.twoRails.tooFew" };
  return { draft: null, create: { left, right }, ...(dropped ? { warning: "m.twoRails.oddDropped" as const } : {}) };
}

// ---------------------------------------------------------------------------
// Preview

export type RailColor = "blue" | "orange";
export interface PreviewPoint {
  p: Vec2;
  rail: 1 | 2;
  shape: "square";
  color: RailColor;
  curved: boolean;
}
export interface Preview {
  points: PreviewPoint[];
  /** The rails as they will be (with the curves), one per rail. */
  rails: { path: SubPath; color: RailColor }[];
  /** Grey dashed rung between each pair. */
  rungs: { a: Vec2; b: Vec2; color: "grey"; dashed: true }[];
}

const COLOR: Record<1 | 2, RailColor> = { 1: "blue", 2: "orange" };

/** What the canvas draws while the user clicks: square points, blue rail 1, orange rail 2, grey dashed rungs. */
export function previewOf(draft: TwoRailDraft): Preview {
  const points = draft.clicks.map((c, i): PreviewPoint => {
    const rail = (i % 2 === 0 ? 1 : 2) as 1 | 2;
    return { p: c.p, rail, shape: "square", color: COLOR[rail], curved: !!c.curved };
  });
  const r1 = draft.clicks.filter((_, i) => i % 2 === 0);
  const r2 = draft.clicks.filter((_, i) => i % 2 === 1);
  const rungs = r2.map((c, k) => ({ a: r1[k].p, b: c.p, color: "grey" as const, dashed: true as const }));
  const rails = [
    { path: railPath(r1), color: COLOR[1] },
    { path: railPath(r2), color: COLOR[2] },
  ];
  return { points, rails, rungs };
}

// ---------------------------------------------------------------------------
// Geometry

const asClick = (c: Click | Vec2): Click => (Array.isArray(c) ? { p: c as Vec2 } : (c as Click));
const unit = (x: number, y: number): Vec2 => {
  const l = Math.hypot(x, y);
  return l < 1e-12 ? [0, 0] : [x / l, y / l];
};
const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * A rail through the clicks: a straight node has no handles; a curved node
 * gets smooth handles along the line from the previous to the next point,
 * each a third of the distance to that neighbour (Catmull-Rom style).
 */
export function railPath(clicks: Click[]): SubPath {
  const pts = clicks.map((c) => c.p);
  const nodes = clicks.map((c, i): PathNode => {
    const p = c.p;
    if (!c.curved) return { p };
    const prev = i > 0 ? pts[i - 1] : null;
    const next = i < pts.length - 1 ? pts[i + 1] : null;
    if (!prev && !next) return { p };
    const a = prev ?? p;
    const b = next ?? p;
    const tg = unit(b[0] - a[0], b[1] - a[1]);
    const node: PathNode = { p };
    if (prev) {
      const k = dist(p, prev) / 3;
      node.i = [p[0] - tg[0] * k, p[1] - tg[1] * k];
    }
    if (next) {
      const k = dist(p, next) / 3;
      node.o = [p[0] + tg[0] * k, p[1] + tg[1] * k];
    }
    return node;
  });
  return { nodes, closed: false };
}

/** "Satin 3": the first number not taken among the design's satins of that name. */
function nextName(objects: DesignObject[], base: string): string {
  const used = new Set(objects.map((o) => o.name));
  let n = 1;
  while (used.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** Filum's default thread for a new object in a design without threads. */
const FIRST_THREAD: Omit<Thread, "id"> = { name: "Cherry", color: "#b3203a", brand: "", code: "" };

/**
 * m.satin.fromClicks: a two-rail satin from the rails' points. Pairs beyond
 * the shorter rail are dropped; fewer than two pairs change nothing. The new
 * satin takes the defaults of new satins (fabric preset, calibration); its
 * rails are never reversed by the engine (reverseRails "none"): the user
 * paired the points, a guess could only pair them wrong.
 */
export function satinFromClicks(doc: StitchDocument, params: FromClicksParams): StitchDocument {
  const left = (params.left ?? []).map(asClick);
  const right = (params.right ?? []).map(asClick);
  const n = Math.min(left.length, right.length);
  if (n < 2) return doc;
  let threads = doc.threads;
  let thread = params.thread && threads.some((x) => x.id === params.thread) ? params.thread : threads[0]?.id;
  if (!thread) {
    thread = uid("t");
    threads = [...threads, { id: thread, ...FIRST_THREAD }];
  }
  const stitch = { ...defaultStitch("satin"), ...newObjectDefaults(doc).satin, multi: false, guides: undefined, reverseRails: "none" } as StitchParams & SatinParams;
  const o: DesignObject = {
    id: uid(),
    name: nextName(doc.objects, t("m.satin.name")),
    thread,
    visible: true,
    locked: false,
    paths: [railPath(left.slice(0, n)), railPath(right.slice(0, n))],
    stitch,
    trimAfter: false,
    stopAfter: false,
  };
  return { ...doc, threads, objects: [...doc.objects, o] };
}
