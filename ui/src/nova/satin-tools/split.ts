// Module m — «Dividi e dirigi»: on the selected shape the user draws cut
// lines (brown) and direction lines (red). m.split.apply cuts the shape where
// the cut lines cross it and turns each part into a two-rail satin whose
// stitches follow the part's direction line. Nothing is chosen by the
// program: where to cut and which way to sew is what the user drew; only a
// part without a line gets the direction across its long side (a warning in
// Studio; in Assisted there are no red lines, so every part is automatic).
//
// Filum's Cutter cuts a fill along the infinite line through two points, so a
// short cut on a letter would also cut far-away strokes and the result would
// depend on the order of the cuts. Here a cut works only along the segment the
// user drew: each stretch of it inside the shape (a chord) splits the shape
// there, or opens a counter (hole) when it runs from the edge into it.
//
// The parts overlap across each cut by the fabric preset's overlap (module e:
// flat hoop / cap frame; 0.2 mm without a preset), half on each side, so no gap
// opens between the satins when the fabric pulls.
//
// The satin of a part is built like Filum's two-rail satins: two rails with as
// many nodes, each pair of nodes a rung (lib/nodeOps railMap). The rungs are
// slices of the part along its direction, so every stitch has the direction
// line's angle; at a step of the outline two rungs a hair apart keep the rails
// on the outline. The rails are never reversed by the engine (reverseRails
// "none"): their pairing is known.

import type { DesignObject, SatinParams, StitchDocument, StitchParams, SubPath, Vec2 } from "../../types";
import type { NovaMode } from "../../types";
import { defaultStitch, flatten, uid } from "../../lib/geometry";
import { applyPlan } from "../../lib/convertActions";
import { newObjectDefaults } from "../presets/apply";
import { presetOf } from "../presets/registry";

export type Line = [Vec2, Vec2];

/** Params of m.split.apply. */
export interface SplitParams {
  /** The shape to split (a fill: closed outlines). */
  id: string;
  /** Cut lines (brown), each a segment; applied in order. */
  cuts: Line[];
  /** Direction lines (red): each sets the stitch angle of the part it lies in. */
  directions: Line[];
}

export interface SplitPlan {
  /** The document with the shape replaced by the satins. */
  doc: StitchDocument;
  /** How many parts (satins). */
  parts: number;
  /** Indices of the parts that got the automatic direction (no line in them). */
  auto: number[];
  /** Parts whose direction line meets the outline more than twice somewhere: sewn along the longest stretch. */
  notOneColumn: number[];
  /** Overlap used at the cuts (mm). */
  overlap: number;
  /** Ids of the new satins, in order. */
  made: string[];
}

/** Overlap between neighbouring parts: the preset's (flat / cap), else 0.2 mm. */
export function overlapFor(doc: StitchDocument): number {
  const p = presetOf(doc);
  if (!p) return 0.2;
  return doc.nova?.hoopKind === "cap" ? p.overlap.cap : p.overlap.flat;
}

/** Warnings (i18n keys) the tool shows after the split, by mode. */
export function splitWarnings(plan: SplitPlan, mode: NovaMode): string[] {
  const out: string[] = [];
  if (mode === "studio" && plan.auto.length) out.push("m.split.autoDirection");
  if (plan.notOneColumn.length) out.push("m.split.notOneColumn");
  return out;
}

// ---------------------------------------------------------------------------
// Plane helpers

const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Vec2, k: number): Vec2 => [a[0] * k, a[1] * k];
const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
const cross = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];
const len = (a: Vec2) => Math.hypot(a[0], a[1]);
const unit = (a: Vec2): Vec2 => {
  const l = len(a);
  return l < 1e-12 ? [0, 0] : [a[0] / l, a[1] / l];
};
const midOf = (a: Vec2, b: Vec2): Vec2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** A vertex of a ring; `tag` marks where a cut crosses the outline. */
interface V {
  p: Vec2;
  tag?: number;
}
type Ring = V[];
/** A part of the shape: one outline (counter-clockwise) and its counters (clockwise). */
interface Region {
  outer: Ring;
  holes: Ring[];
}

function signedArea(r: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < r.length; i++) s += cross(r[i], r[(i + 1) % r.length]);
  return s / 2;
}

/** Even-odd test against rings. */
function insideRings(rings: Vec2[][], q: Vec2): boolean {
  let c = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [a, b] = [r[i], r[j]];
      if (a[1] > q[1] !== b[1] > q[1] && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
  return c;
}
const pts = (r: Ring) => r.map((v) => v.p);
const insideRegion = (g: Region, q: Vec2) => insideRings([pts(g.outer), ...g.holes.map(pts)], q);
const regionArea = (g: Region) => Math.abs(signedArea(pts(g.outer))) - g.holes.reduce((s, h) => s + Math.abs(signedArea(pts(h))), 0);

/** The shape's closed outlines as regions: each outline with the counters inside it. */
export function regionsOf(o: DesignObject): Region[] {
  const rings = o.paths
    .filter((sp) => sp.closed && sp.nodes.length >= 3)
    .map((sp) => {
      const r = flatten(sp, 16);
      if (r.length > 2 && len(sub(r[0], r[r.length - 1])) < 1e-9) r.pop();
      return r.filter((p, i) => i === 0 || len(sub(p, r[i - 1])) > 1e-9);
    })
    .filter((r) => r.length >= 3 && Math.abs(signedArea(r)) > 1e-9);
  // depth: how many other outlines hold the ring; even = outline, odd = counter
  const depth = rings.map((r, i) => rings.filter((q, j) => j !== i && insideRings([q], r[0])).length);
  const orient = (r: Vec2[], ccw: boolean): Ring => ((signedArea(r) > 0) === ccw ? r : [...r].reverse()).map((p) => ({ p }));
  const outers = rings.map((r, i) => ({ r, i })).filter(({ i }) => depth[i] % 2 === 0);
  const regions: Region[] = outers.map(({ r }) => ({ outer: orient(r, true), holes: [] }));
  rings.forEach((r, i) => {
    if (depth[i] % 2 === 0) return;
    // the smallest outline holding it
    let best = -1;
    outers.forEach(({ r: q }, k) => {
      if (insideRings([q], r[0]) && (best < 0 || Math.abs(signedArea(q)) < Math.abs(signedArea(outers[best].r)))) best = k;
    });
    if (best >= 0) regions[best].holes.push(orient(r, false));
  });
  return regions;
}

// ---------------------------------------------------------------------------
// Cutting along a segment

interface Hit {
  ring: number; // 0 = outer, 1.. = holes
  edge: number;
  te: number; // along the edge
  ts: number; // along the cut
  p: Vec2;
}

/** Where segment a→b crosses the region's outlines, along the cut. */
function hitsOf(g: Region, a: Vec2, b: Vec2): Hit[] {
  const rings = [g.outer, ...g.holes];
  const d = sub(b, a);
  const out: Hit[] = [];
  rings.forEach((r, ri) => {
    for (let i = 0; i < r.length; i++) {
      const p = r[i].p;
      const q = r[(i + 1) % r.length].p;
      const e = sub(q, p);
      const den = cross(d, e);
      if (Math.abs(den) < 1e-12) continue;
      const w = sub(p, a);
      const ts = cross(w, e) / den;
      const te = cross(w, d) / den;
      if (ts < 0 || ts > 1 || te < 0 || te >= 1) continue;
      out.push({ ring: ri, edge: i, te, ts, p: add(a, mul(d, ts)) });
    }
  });
  return out.sort((x, y) => x.ts - y.ts);
}

/** The stretches of the cut inside the region, in order along it (empty: the cut misses it). */
function chordsOf(g: Region, a: Vec2, b: Vec2): [Hit, Hit][] {
  const hits = hitsOf(g, a, b);
  const out: [Hit, Hit][] = [];
  for (let k = 0; k + 1 < hits.length; k++) {
    const [h0, h1] = [hits[k], hits[k + 1]];
    if (h1.ts - h0.ts < 1e-9) continue;
    if (insideRegion(g, midOf(h0.p, h1.p))) out.push([h0, h1]);
  }
  return out;
}

/** Split region g along the segment a→b: each chord splits an outline or opens a counter. */
function splitRegion(g: Region, a: Vec2, b: Vec2): Region[] {
  const chords = chordsOf(g, a, b);
  if (!chords.length) return [g];
  // put every chord end into its ring as a tagged vertex
  const rings: Ring[] = [g.outer, ...g.holes].map((r) => r.map((v) => ({ p: v.p })));
  const byRing = new Map<number, { edge: number; te: number; tag: number; p: Vec2 }[]>();
  chords.forEach(([h0, h1], k) => {
    for (const [h, tag] of [
      [h0, 2 * k],
      [h1, 2 * k + 1],
    ] as const) {
      if (!byRing.has(h.ring)) byRing.set(h.ring, []);
      byRing.get(h.ring)!.push({ edge: h.edge, te: h.te, tag, p: h.p });
    }
  });
  for (const [ri, list] of byRing) {
    list.sort((x, y) => x.edge - y.edge || x.te - y.te);
    const r = rings[ri];
    const out: Ring = [];
    let k = 0;
    for (let i = 0; i < r.length; i++) {
      out.push(r[i]);
      while (k < list.length && list[k].edge === i) {
        out.push({ p: list[k].p, tag: list[k].tag });
        k++;
      }
    }
    rings[ri] = out;
  }
  let parts: Region[] = [{ outer: rings[0], holes: rings.slice(1) }];
  chords.forEach((_, k) => {
    const [tx, ty] = [2 * k, 2 * k + 1];
    const find = (rg: Region, tag: number) => {
      const all = [rg.outer, ...rg.holes];
      for (let ri = 0; ri < all.length; ri++) {
        const vi = all[ri].findIndex((v) => v.tag === tag);
        if (vi >= 0) return { ri, vi };
      }
      return null;
    };
    const pi = parts.findIndex((rg) => find(rg, tx) && find(rg, ty));
    if (pi < 0) return;
    const rg = parts[pi];
    const X = find(rg, tx)!;
    const Y = find(rg, ty)!;
    const all = [rg.outer, ...rg.holes];
    if (X.ri === Y.ri) {
      // a chord across the outline: two parts, each counter goes with the part holding it
      if (X.ri !== 0) return;
      const r = rg.outer;
      const [i, j] = X.vi < Y.vi ? [X.vi, Y.vi] : [Y.vi, X.vi];
      const ra = r.slice(i, j + 1);
      const rb = [...r.slice(j), ...r.slice(0, i + 1)];
      const holesOf = (q: Ring) => rg.holes.filter((h) => insideRings([pts(q)], h[0].p));
      parts.splice(pi, 1, { outer: ra, holes: holesOf(ra) }, { outer: rb, holes: holesOf(rb) });
      return;
    }
    // a chord from one outline to another: the two join through it (a counter opens)
    const [P, Q] = X.ri < Y.ri ? [X, Y] : [Y, X];
    const rp = all[P.ri];
    const rq = all[Q.ri];
    const joined: Ring = [...rp.slice(0, P.vi + 1), ...rq.slice(Q.vi), ...rq.slice(0, Q.vi + 1), { p: rp[P.vi].p }, ...rp.slice(P.vi + 1)];
    const rest = all.filter((_, ri) => ri !== P.ri && ri !== Q.ri);
    parts[pi] = P.ri === 0 ? { outer: joined, holes: rest.slice(0) } : { outer: rg.outer, holes: [...rg.holes.filter((h) => h !== rp && h !== rq), joined] };
  });
  return parts.filter((rg) => regionArea(rg) > 1e-4);
}

/**
 * Cut every part the segment crosses, the parts passing the cut by half the
 * overlap each: the side ahead of the cut is cut a half-overlap behind it and
 * the other way round, and of each cut only the parts touching the drawn cut
 * are kept.
 */
function cutParts(parts: Region[], cut: Line, overlap: number): Region[] {
  const [a, b] = cut;
  const n = unit([-(b[1] - a[1]), b[0] - a[0]]);
  if (!(len(sub(b, a)) > 1e-9)) return parts;
  return parts.flatMap((g) => {
    const chords = chordsOf(g, a, b);
    if (!chords.length) return [g];
    const plain = splitRegion(g, a, b);
    if (!(overlap > 0) || plain.length < 2) return plain;
    const mids = chords.map(([h0, h1]) => midOf(h0.p, h1.p));
    const h = overlap / 2;
    const side = (k: number) => {
      const off = mul(n, k * h);
      const pieces = splitRegion(g, add(a, off), add(b, off));
      return pieces.length < 2 ? null : pieces.filter((rg) => mids.some((m) => insideRegion(rg, m)));
    };
    // shifted back: the parts ahead, grown back over the cut; shifted ahead: the parts behind
    const ahead = side(-1);
    const behind = side(1);
    if (!ahead || !behind) return plain;
    return [...ahead, ...behind];
  });
}

// ---------------------------------------------------------------------------
// Directions

/** Stitch direction across the part's long side: the narrowest box around it (rotating calipers on the hull). */
function autoDirection(g: Region): Vec2 {
  const P = [...pts(g.outer)].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const half = (list: Vec2[]) => {
    const h: Vec2[] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(sub(h[h.length - 1], h[h.length - 2]), sub(p, h[h.length - 2])) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  const hull = [...half(P), ...half([...P].reverse())];
  let best = { area: Infinity, long: [1, 0] as Vec2 };
  for (let i = 0; i < hull.length; i++) {
    const e = unit(sub(hull[(i + 1) % hull.length], hull[i]));
    if (!e[0] && !e[1]) continue;
    const nrm: Vec2 = [-e[1], e[0]];
    const us = hull.map((p) => dot(p, e));
    const vs = hull.map((p) => dot(p, nrm));
    const du = Math.max(...us) - Math.min(...us);
    const dv = Math.max(...vs) - Math.min(...vs);
    if (du * dv < best.area - 1e-9) best = { area: du * dv, long: du >= dv ? e : nrm };
  }
  return [-best.long[1], best.long[0]];
}

/** The part a direction line belongs to: the one holding most of it. */
function partOfLine(parts: Region[], l: Line): number {
  let best = -1;
  let most = 0;
  parts.forEach((g, k) => {
    let n = 0;
    for (let i = 0; i <= 20; i++) if (insideRegion(g, add(l[0], mul(sub(l[1], l[0]), i / 20)))) n++;
    if (n > most) {
      most = n;
      best = k;
    }
  });
  return best;
}

// ---------------------------------------------------------------------------
// A part → two rails

const EPS = 1e-7;

/**
 * Rails of a part sewn along `d`: slices of the part parallel to d at every
 * corner of its outline (a hair before and after, so a step in the outline
 * keeps the rails on it); rail 1 the start of each slice, rail 2 its end.
 * Corners on a straight stretch of both rails are dropped.
 */
function railsOf(g: Region, dir: Vec2): { rails: [Vec2[], Vec2[]]; oneColumn: boolean } | null {
  const d = unit(dir);
  const u: Vec2 = [-d[1], d[0]];
  const rings = [g.outer, ...g.holes].map(pts);
  const ss = [...new Set(rings.flat().map((p) => dot(p, u)))].sort((x, y) => x - y);
  const s0 = ss[0];
  const s1 = ss[ss.length - 1];
  if (!(s1 - s0 > 1e-6)) return null;
  const at: number[] = [];
  for (const s of ss) {
    if (s > s0) at.push(s - EPS);
    if (s < s1) at.push(s + EPS);
  }
  let oneColumn = true;
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  for (const s of at) {
    const vs: number[] = [];
    for (const r of rings)
      for (let i = 0; i < r.length; i++) {
        const p = r[i];
        const q = r[(i + 1) % r.length];
        const [ps, qs] = [dot(p, u), dot(q, u)];
        if ((ps <= s && s < qs) || (qs <= s && s < ps)) {
          const t = (s - ps) / (qs - ps);
          vs.push(dot(add(p, mul(sub(q, p), t)), d));
        }
      }
    vs.sort((x, y) => x - y);
    let spans: [number, number][] = [];
    for (let k = 0; k + 1 < vs.length; k += 2) spans.push([vs[k], vs[k + 1]]);
    const real = spans.filter(([x, y]) => y - x > 1e-6);
    if (real.length > 1) oneColumn = false;
    if (real.length) spans = real;
    if (!spans.length) continue;
    const [v0, v1] = spans.reduce((m, x) => (x[1] - x[0] > m[1] - m[0] ? x : m));
    left.push(add(mul(u, s), mul(d, v0)));
    right.push(add(mul(u, s), mul(d, v1)));
  }
  // drop slices on a straight stretch of both rails
  const offLine = (p: Vec2, a: Vec2, b: Vec2) => {
    const e = sub(b, a);
    const l = len(e);
    return l < 1e-12 ? len(sub(p, a)) : Math.abs(cross(e, sub(p, a))) / l;
  };
  for (let k = 1; k < left.length - 1; ) {
    if (offLine(left[k], left[k - 1], left[k + 1]) < 1e-5 && offLine(right[k], right[k - 1], right[k + 1]) < 1e-5) {
      left.splice(k, 1);
      right.splice(k, 1);
    } else k++;
  }
  if (left.length < 2) return null;
  return { rails: [left, right], oneColumn };
}

const path = (p: Vec2[]): SubPath => ({ closed: false, nodes: p.map((q) => ({ p: q })) });

// ---------------------------------------------------------------------------
// The command

/** What m.split.apply does, with what the tool needs to tell the user. Null: nothing to split. */
export function planSplit(doc: StitchDocument, params: SplitParams): SplitPlan | null {
  const o = doc.objects.find((x) => x.id === params.id);
  if (!o || o.text) return null;
  let parts = regionsOf(o);
  if (!parts.length) return null;
  const overlap = overlapFor(doc);
  for (const cut of params.cuts ?? []) parts = cutParts(parts, cut, overlap);
  const dirs: (Line | null)[] = parts.map(() => null);
  for (const l of params.directions ?? []) {
    if (!(len(sub(l[1], l[0])) > 1e-9)) continue;
    const k = partOfLine(parts, l);
    if (k >= 0 && !dirs[k]) dirs[k] = l;
  }
  const auto: number[] = [];
  const notOneColumn: number[] = [];
  const base = { ...defaultStitch("satin"), ...newObjectDefaults(doc).satin, multi: false, guides: undefined, reverseRails: "none" } as StitchParams & SatinParams;
  const group = parts.length > 1 ? uid("g") : undefined;
  const made: DesignObject[] = [];
  parts.forEach((g, k) => {
    const l = dirs[k];
    if (!l) auto.push(k);
    const r = railsOf(g, l ? sub(l[1], l[0]) : autoDirection(g));
    if (!r) return;
    if (!r.oneColumn) notOneColumn.push(k);
    made.push({
      id: uid(),
      name: parts.length > 1 ? `${o.name} ${k + 1}` : o.name,
      thread: o.thread,
      visible: o.visible,
      locked: false,
      paths: [path(r.rails[0]), path(r.rails[1])],
      stitch: { ...base },
      trimAfter: false,
      stopAfter: false,
      ...(group ? { group } : o.group ? { group: o.group } : {}),
    });
  });
  if (!made.length) return null;
  const out = applyPlan(doc, { replace: { [o.id]: made }, select: made.map((m) => m.id), summary: "" });
  return { doc: out, parts: made.length, auto, notOneColumn, overlap, made: made.map((m) => m.id) };
}

/** m.split.apply: the shape replaced by its satins (one undo step through runCommand). */
export function applySplit(doc: StitchDocument, params: SplitParams): StitchDocument {
  return planSplit(doc, params)?.doc ?? doc;
}
