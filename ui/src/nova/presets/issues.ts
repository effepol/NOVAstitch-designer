// Module e's warnings (contract, module e: new warnings from the Punch book),
// in Filum's Issue form so module 0's issue registry can list them beside
// Filum's own. Pure: the document, the stitch plan and the preset in force.
//   dense         stitches closer than the preset allows for the thread (e.11)
//   facing        stretchy fabric: adjacent fills whose rows sew towards each other (e.12)
//   zigzagOnly    satin with zig-zag underlay and no contour (e.13)
//   contourOrder  knit: a shape's contour not sewn right after it (e.14)
//   narrowRows    curved fill: rows closer than the set distance in narrow places (e.15)
// «Satin too wide» (e.7) is Filum's own warning (lib/issues.ts): not repeated here.
// Ids are "e.<kind>:<object id>", the same for the same design and plan (e.issue.fix finds them again).

import type { DesignObject, FillParams, PlanData, SatinParams, StitchDocument, Vec2 } from "../../types";
import { FLAG } from "../../types";
import type { Issue } from "../../lib/issues";
import { flatten, objectBoundsCached } from "../../lib/geometry";
import { threadWidth } from "../../lib/materials";
import { t } from "../core/i18n";
import type { FabricPreset } from "./preset";
import { round6 } from "./round";
import "./texts";

/** Measuring tolerances (geometry, not embroidery values). */
const TOL = {
  /** Fills this close (mm) count as adjacent. */
  adjacent: 1,
  /** A line counts as a shape's contour when this share of it lies within `contour` mm of the shape's outline. */
  contourShare: 0.9,
  contour: 1,
  /** Rows count as parallel within this angle (degrees). */
  parallel: 20,
  /** Rows closer than the set distance by more than this (mm, half the DST's 0.1 mm step) are warned about. */
  rows: 0.05,
};

/** The stitch points of each object in the plan, without underlay, travel and ties; null when it has none. */
function pointsByObject(plan: PlanData | null, n: number): (Vec2[][] | null)[] {
  const out: (Vec2[][] | null)[] = Array.from({ length: n }, () => null);
  if (!plan) return out;
  let last = -1;
  for (let i = 0; i < plan.flags.length; i++) {
    const f = plan.flags[i];
    const o = plan.objects[i];
    if (f & FLAG.COMMANDS && !(f & FLAG.JUMP)) {
      last = -1;
      continue;
    }
    if (o >= n || f & (FLAG.UNDERLAY | FLAG.TRAVEL | FLAG.TIE)) {
      last = -1;
      continue;
    }
    const runs = (out[o] ??= []);
    const p: Vec2 = [plan.coords[2 * i], plan.coords[2 * i + 1]];
    if (f & FLAG.JUMP || last !== o || !runs.length) runs.push([p]);
    else runs[runs.length - 1].push(p);
    last = o;
  }
  return out;
}

const weightOf = (doc: StitchDocument, o: DesignObject) => doc.threads.find((x) => x.id === o.thread)?.weight ?? doc.options?.threadWeight ?? 40;
const centre = (o: DesignObject): Vec2 | null => {
  const b = objectBoundsCached(o);
  return b ? [b.x + b.w / 2, b.y + b.h / 2] : null;
};

/** Distance from p to the segment ab. */
function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const u = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy);
}

/** Points every `step` mm along a polyline. */
function sample(pts: Vec2[], step = 0.5): Vec2[] {
  const out: Vec2[] = pts.length ? [pts[0]] : [];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/** Is `line` (a running or satin object) the contour of the shape `shape`? */
function isContourOf(line: DesignObject, shape: DesignObject): boolean {
  const outline = shape.paths.map((sp) => {
    const pts = flatten(sp);
    return sp.closed && pts.length ? [...pts, pts[0]] : pts;
  });
  const pts = line.paths.flatMap((sp) => sample(flatten(sp)));
  if (pts.length < 2) return false;
  const tol = TOL.contour + (line.stitch.type === "satin" ? (line.stitch as SatinParams).width / 2 : 0);
  const near = pts.filter((p) => outline.some((ring) => ring.some((_, i) => i > 0 && segDist(p, ring[i - 1], ring[i]) <= tol))).length;
  // and it goes most of the way round
  const lb = objectBoundsCached(line);
  const sb = objectBoundsCached(shape);
  const covers = !!lb && !!sb && lb.w >= sb.w * 0.8 && lb.h >= sb.h * 0.8;
  return covers && near / pts.length >= TOL.contourShare;
}

/** The closest pair of parallel, side-by-side stitches of different rows: their distance and middle. */
function closestRows(runs: Vec2[][]): { d: number; at: Vec2 } | null {
  type Seg = { a: Vec2; b: Vec2; ux: number; uy: number; len: number; run: number; k: number };
  const segs: Seg[] = [];
  runs.forEach((pts, run) => {
    for (let k = 1; k < pts.length; k++) {
      const [a, b] = [pts[k - 1], pts[k]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len > 0.05) segs.push({ a, b, ux: (b[0] - a[0]) / len, uy: (b[1] - a[1]) / len, len, run, k });
    }
  });
  // a grid of 1 mm cells on the stitches' middles
  const cell = (x: number, y: number) => `${Math.floor(x)},${Math.floor(y)}`;
  const grid = new Map<string, number[]>();
  segs.forEach((s, i) => {
    const m = cell((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2);
    grid.set(m, [...(grid.get(m) ?? []), i]);
  });
  const cos = Math.cos((TOL.parallel * Math.PI) / 180);
  let best: { d: number; at: Vec2 } | null = null;
  segs.forEach((s, i) => {
    const mx = (s.a[0] + s.b[0]) / 2;
    const my = (s.a[1] + s.b[1]) / 2;
    for (let gx = -1; gx <= 1; gx++)
      for (let gy = -1; gy <= 1; gy++)
        for (const j of grid.get(cell(mx + gx, my + gy)) ?? []) {
          const o = segs[j];
          if (j === i || (o.run === s.run && Math.abs(o.k - s.k) <= 1)) continue;
          if (Math.abs(s.ux * o.ux + s.uy * o.uy) < cos) continue;
          // the middle of s must lie beside o, not beyond its ends (stitches of one row lie end to end)
          const u = (mx - o.a[0]) * o.ux + (my - o.a[1]) * o.uy;
          if (u <= 0 || u >= o.len) continue;
          const d = Math.abs((mx - o.a[0]) * o.uy - (my - o.a[1]) * o.ux);
          if (d < 0.02) continue; // the same row going on
          if (!best || d < best.d) best = { d, at: [mx, my] };
        }
  });
  return best;
}

export function fabricIssues(doc: StitchDocument, plan: PlanData | null, preset: FabricPreset | null): Issue[] {
  const out: Issue[] = [];
  const objects = doc.objects;
  const runs = pointsByObject(plan, objects.length);
  const add = (kind: string, o: DesignObject, i: Omit<Issue, "id" | "objId">) => out.push({ ...i, id: `e.${kind}:${o.id}`, objId: o.id });

  objects.forEach((o, index) => {
    if (!o.visible) return;
    const c = centre(o);
    if (!c) return;
    const st = o.stitch;

    // e.11: closer than the preset allows for this thread (No. 40's limit scaled with the thread's width)
    if (preset && (st.type === "satin" || (st.type === "fill" && (st.method ?? "tatami") === "tatami"))) {
      const w = weightOf(doc, o);
      const limit = round6((preset.limits.minSpacing * threadWidth(w as 40)) / threadWidth(40));
      const spacing = st.type === "satin" ? st.spacing : (st as FillParams).rowSpacing;
      if (spacing < limit)
        add("dense", o, {
          level: "warning",
          title: t("e.issue.dense.title"),
          detail: t("e.issue.dense.detail", { spacing, limit, weight: w }),
          at: c,
          fix: {
            label: t("e.issue.dense.fix", { limit }),
            apply: (x) =>
              x.stitch.type === "satin" ? { ...x, stitch: { ...x.stitch, spacing: limit } } : x.stitch.type === "fill" ? { ...x, stitch: { ...x.stitch, rowSpacing: limit } } : x,
          },
        });
    }

    // e.13: satin with zig-zag underlay and no contour (the engine's automatic underlay chooses for itself)
    if (st.type === "satin" && st.zigzagUnderlay && !st.contourUnderlay && !st.underlayAuto)
      add("zigzagOnly", o, {
        level: "warning",
        title: t("e.issue.zigzagOnly.title"),
        detail: t("e.issue.zigzagOnly.detail"),
        at: c,
        fix: { label: t("e.issue.zigzagOnly.fix"), apply: (x) => (x.stitch.type === "satin" ? { ...x, stitch: { ...x.stitch, contourUnderlay: true } } : x) },
      });

    // e.15: curved fill whose rows come closer than the set distance
    if (st.type === "fill" && (st.method === "curved" || st.method === "flow" || st.method === "guided")) {
      const r = runs[index];
      const close = r ? closestRows(r) : null;
      if (close && close.d < st.rowSpacing - TOL.rows) {
        const d = round6(Math.round(close.d * 100) / 100);
        add("narrowRows", o, {
          level: "warning",
          title: t("e.issue.narrowRows.title"),
          detail: t("e.issue.narrowRows.detail", { d, spacing: st.rowSpacing, x: close.at[0].toFixed(1), y: close.at[1].toFixed(1) }),
          at: close.at,
        });
      }
    }
  });

  if (preset?.elastic) {
    // e.12: adjacent fills whose rows sew towards each other (each from its first to its last stitch)
    const fills = objects.map((o, i) => ({ o, i })).filter(({ o }) => o.visible && o.stitch.type === "fill");
    const progress = (i: number): Vec2 | null => {
      const r = runs[i];
      if (!r?.length) return null;
      const first = r[0][0];
      const lastRun = r[r.length - 1];
      const last = lastRun[lastRun.length - 1];
      return [last[0] - first[0], last[1] - first[1]];
    };
    const facing = new Map<string, string>();
    for (let a = 0; a < fills.length; a++)
      for (let b = a + 1; b < fills.length; b++) {
        const [A, B] = [fills[a], fills[b]];
        const ba = objectBoundsCached(A.o);
        const bb = objectBoundsCached(B.o);
        if (!ba || !bb) continue;
        const gapX = Math.max(ba.x - (bb.x + bb.w), bb.x - (ba.x + ba.w));
        const gapY = Math.max(ba.y - (bb.y + bb.h), bb.y - (ba.y + ba.h));
        if (gapX > TOL.adjacent || gapY > TOL.adjacent) continue;
        const pa = progress(A.i);
        const pb = progress(B.i);
        if (!pa || !pb) continue;
        const d: Vec2 = [bb.x + bb.w / 2 - (ba.x + ba.w / 2), bb.y + bb.h / 2 - (ba.y + ba.h / 2)];
        const dl = Math.hypot(d[0], d[1]) || 1;
        const towardsB = (pa[0] * d[0] + pa[1] * d[1]) / dl;
        const towardsA = -(pb[0] * d[0] + pb[1] * d[1]) / dl;
        if (towardsB > TOL.adjacent && towardsA > TOL.adjacent) {
          if (!facing.has(A.o.id)) facing.set(A.o.id, B.o.name);
          if (!facing.has(B.o.id)) facing.set(B.o.id, A.o.name);
        }
      }
    for (const o of objects) {
      const other = facing.get(o.id);
      const c = centre(o);
      if (other !== undefined && c) add("facing", o, { level: "warning", title: t("e.issue.facing.title"), detail: t("e.issue.facing.detail", { other }), at: c });
    }

    // e.14: on knit a shape's contour comes right after the shape, before the next section
    objects.forEach((line, j) => {
      if (!line.visible || (line.stitch.type !== "running" && line.stitch.type !== "satin")) return;
      for (let i = j - 1; i >= 0; i--) {
        const shape = objects[i];
        if (shape.stitch.type !== "fill" || !isContourOf(line, shape)) continue;
        if (i < j - 1) {
          const c = centre(line);
          if (c) add("contourOrder", line, { level: "warning", title: t("e.issue.contourOrder.title"), detail: t("e.issue.contourOrder.detail", { shape: shape.name }), at: c });
        }
        break;
      }
    });
  }
  return out;
}
