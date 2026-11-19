// Troubleshoot (Ink/Stitch "Troubleshoot objects", extended): finds problems
// in the design and the generated stitches, locates them on the canvas and
// offers one-click fixes.

import { t } from "../nova/i18n/filum";
import type { DesignObject, PlanData, StitchDocument, Vec2 } from "../types";
import { FLAG } from "../types";
import { objectBoundsCached, transformObject, translateMat } from "./geometry";
import { rowAngleFor, rowsAlongGradient } from "./gradient";
import { ovalNorm, threadWeightInfo } from "./materials";
import { shapeProblems } from "./shapeCheck";
import { lineOverlaps } from "./lineOverlaps";
import { issueChecksVersion, moduleIssues } from "../nova/core/issueChecks";

export interface Issue {
  id: string;
  objId: string;
  level: "error" | "warning" | "info";
  title: string;
  detail: string;
  at: Vec2;
  /** A one-click fix: `apply` to the object, or to every object `scope` picks
   *  (all the layers of a gradient). */
  fix?: { label: string; apply: (o: DesignObject) => DesignObject | null; scope?: (o: DesignObject) => boolean };
}

const cache = new WeakMap<StitchDocument, { plan: PlanData | null; checks: number; issues: Issue[] }>();

/** Per-object statistics of a plan (by object index). */
interface PlanStats {
  stitches: Uint32Array;
  /** Oval hoops: how far each object reaches (1 = on the ellipse); empty otherwise. */
  reach: Float32Array;
  longest: Float32Array;
  /** Middle of each object's longest stitch (x, y). */
  longestAt: Float32Array;
}
const planStats = new WeakMap<PlanData, { key: string; stats: PlanStats }>();

/** The plan's per-object statistics: once per plan (a move only changes the document). */
function statsOf(plan: PlanData, n: number, hw: number, hh: number, oval: boolean): PlanStats {
  const key = `${n}:${hw}:${hh}:${oval}`;
  const hit = planStats.get(plan);
  if (hit && hit.key === key) return hit.stats;
  const { coords, flags, objects } = plan;
  let size = n;
  for (let i = 0; i < objects.length; i++) if (objects[i] !== 0xffffffff && objects[i] >= size) size = objects[i] + 1;
  const st: PlanStats = { stitches: new Uint32Array(size), reach: new Float32Array(oval ? size : 0), longest: new Float32Array(size), longestAt: new Float32Array(size * 2) };
  let pen = false;
  let px = 0;
  let py = 0;
  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];
    const x = coords[2 * i];
    const y = coords[2 * i + 1];
    if (f & (FLAG.COLOR_CHANGE | FLAG.TRIM | FLAG.STOP | FLAG.END)) {
      pen = false;
      continue;
    }
    if (f & FLAG.JUMP) {
      pen = false;
      px = x;
      py = y;
      continue;
    }
    const o = objects[i];
    if (o < size) {
      st.stitches[o]++;
      if (oval) st.reach[o] = Math.max(st.reach[o], ovalNorm(hw / 2, hh / 2, hw, hh, x, y));
      if (pen) {
        const l = Math.hypot(x - px, y - py);
        if (l > st.longest[o]) {
          st.longest[o] = l;
          st.longestAt[2 * o] = (x + px) / 2;
          st.longestAt[2 * o + 1] = (y + py) / 2;
        }
      }
    }
    pen = true;
    px = x;
    py = y;
  }
  planStats.set(plan, { key, stats: st });
  return st;
}

/** Shape geometry problems, once per object (unchanged objects keep their identity while another one moves). */
const shapeCache = new WeakMap<DesignObject, ReturnType<typeof shapeProblems>>();
function shapeProblemsCached(o: DesignObject) {
  let r = shapeCache.get(o);
  if (!r) shapeCache.set(o, (r = shapeProblems(o)));
  return r;
}

export function computeIssues(doc: StitchDocument, plan: PlanData | null): Issue[] {
  const hit = cache.get(doc);
  if (hit && hit.plan === plan && hit.checks === issueChecksVersion()) return hit.issues;
  const out: Issue[] = [];
  const hw = doc.hoop.width;
  const hh = doc.hoop.height;

  // per-object stitch statistics from the plan
  const oval = doc.hoop.shape === "oval";
  const ps = plan ? statsOf(plan, doc.objects.length, hw, hh, oval) : null;
  const stitchesOf = (i: number) => (ps && i < ps.stitches.length ? ps.stitches[i] : 0);
  const reachOf = (i: number): number | undefined => (ps && i < ps.reach.length && ps.stitches[i] ? ps.reach[i] : undefined);
  const longestOf = (i: number): { len: number; at: Vec2 } | undefined =>
    ps && i < ps.longest.length && ps.longest[i] > 0 ? { len: ps.longest[i], at: [ps.longestAt[2 * i], ps.longestAt[2 * i + 1]] } : undefined;

  // lines lying on top of each other (auto-routed lines travel back on purpose)
  const overlaps = new Map(lineOverlaps(doc.objects, { skipSelf: (o) => !!o.routed }).map((x) => [x.id, x]));
  const nameOf = (id: string) => doc.objects.find((o) => o.id === id)?.name ?? t("filum.messaggi.another_line");

  // lettering smaller than the thread weight allows (once per text group)
  const weight = threadWeightInfo(doc.options?.threadWeight);
  const smallText = new Set<string>();

  doc.objects.forEach((o, index) => {
    if (!o.visible) return;
    const b = objectBoundsCached(o);
    if (!b) return;
    const c: Vec2 = [b.x + b.w / 2, b.y + b.h / 2];
    const add = (i: Omit<Issue, "id" | "objId">) => out.push({ ...i, id: `${o.id}:${out.length}`, objId: o.id });
    const st = o.stitch;

    const ov = overlaps.get(o.id);
    if (ov) {
      const mm = ov.length.toFixed(ov.length < 10 ? 1 : 0);
      if (ov.other && ov.share >= 0.95)
        add({
          level: "warning",
          title: t("filum.messaggi.line_on_top_of_another"),
          detail: t("filum.messaggi.it_lies_on_v1_the", { v1: nameOf(ov.other), mm }),
          at: ov.at,
          fix: { label: t("filum.messaggi.delete_it"), apply: () => null },
        });
      else
        add({
          level: ov.other ? "warning" : "info",
          title: ov.other ? t("filum.messaggi.lines_on_top_of_each") : t("filum.messaggi.line_runs_over_itself"),
          detail: ov.other
            ? t("filum.messaggi.mm_mm_of_it_lies", { mm, v2: nameOf(ov.other) })
            : t("filum.messaggi.mm_mm_of_it_goes", { mm }),
          at: ov.at,
          fix: { label: t("filum.messaggi.cut_out_the_doubled_part"), apply: () => ov.cut() },
        });
    }

    const outsideBox = b.x < -0.01 || b.y < -0.01 || b.x + b.w > hw + 0.01 || b.y + b.h > hh + 0.01;
    const outsideOval = oval && !outsideBox && (reachOf(index) ?? Math.max(...[[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y]) => ovalNorm(hw / 2, hh / 2, hw, hh, x, y)))) > 1.0005;
    if (outsideOval) {
      add({
        level: "error",
        title: t("filum.messaggi.outside_the_oval_hoop"),
        detail: t("filum.messaggi.part_of_this_object_lies"),
        at: c,
        fix: { label: t("filum.messaggi.move_to_the_centre"), apply: (x) => transformObject(x, translateMat(hw / 2 - c[0], hh / 2 - c[1])) },
      });
    }
    if (outsideBox) {
      add({
        level: "error",
        title: t("filum.messaggi.outside_the_hoop"),
        detail: t("filum.messaggi.part_of_this_object_can"),
        at: [Math.min(Math.max(c[0], 0), hw), Math.min(Math.max(c[1], 0), hh)],
        fix: {
          label: t("filum.messaggi.move_inside"),
          apply: (x) => {
            const dx = b.x < 0 ? -b.x : b.x + b.w > hw ? hw - (b.x + b.w) : 0;
            const dy = b.y < 0 ? -b.y : b.y + b.h > hh ? hh - (b.y + b.h) : 0;
            return transformObject(x, translateMat(dx, dy));
          },
        },
      });
    }
    if (o.text && o.text.size < weight.minText && !smallText.has(o.text.group)) {
      smallText.add(o.text.group);
      add({
        level: "warning",
        title: t("filum.messaggi.lettering_too_small_for_the"),
        detail: t("filum.messaggi.v1_mm_letters_no_weight", { v1: o.text.size.toFixed(1), weight: weight.weight, minText: weight.minText, minTextSource: weight.minTextSource }),
        at: c,
      });
    }
    if (plan && st.type !== "none" && !stitchesOf(index)) {
      add({ level: "warning", title: t("filum.messaggi.produces_no_stitches"), detail: t("filum.messaggi.the_shape_may_be_too"), at: c });
    }
    if (st.type === "satin") {
      const w = o.paths.length === 1 ? st.width : undefined;
      if (w !== undefined && w > 9 && st.maxStitchLength === 0) {
        add({
          level: "warning",
          title: t("filum.messaggi.satin_too_wide"),
          detail: t("filum.messaggi.v1_mm_stitches_can_snag", { v1: w.toFixed(1) }),
          at: c,
          fix: { label: t("filum.messaggi.split_at_7_mm"), apply: (x) => (x.stitch.type === "satin" ? { ...x, stitch: { ...x.stitch, maxStitchLength: 7 } } : x) },
        });
      }
      if (w !== undefined && w < 0.8) {
        add({
          level: "warning",
          title: t("filum.messaggi.satin_too_narrow"),
          detail: t("filum.messaggi.columns_under_0_8_mm"),
          at: c,
          fix: { label: t("filum.messaggi.use_triple_run"), apply: (x) => ({ ...x, stitch: { type: "running", length: 1.8, tolerance: 0.2, repeats: 1, beanRepeats: 2 } }) },
        });
      }
    }
    if (st.type === "fill") {
      // once per gradient (its first colour), the fix turns every layer
      if (st.gradient?.layer === 0 && rowsAlongGradient(st)) {
        const g = st.gradient;
        const across = rowAngleFor(g.from, g.to);
        add({
          level: "warning",
          title: t("filum.messaggi.rows_run_along_the_gradient"),
          detail: t("filum.messaggi.every_row_is_split_between"),
          at: c,
          fix: {
            label: t("filum.messaggi.turn_rows_across"),
            apply: (x) => (x.stitch.type === "fill" ? { ...x, stitch: { ...x.stitch, angle: across } } : x),
            scope: (x) => x.stitch.type === "fill" && x.stitch.gradient?.group === g.group,
          },
        });
      }
      if (Math.max(b.w, b.h) < 2.5) {
        add({ level: "info", title: t("filum.messaggi.very_small_fill"), detail: t("filum.messaggi.fills_under_2_5_mm"), at: c });
      }
      if (st.rowSpacing < 0.2 && (st.method === "tatami" || st.method === "contour" || st.method === "spiral")) {
        add({
          level: "warning",
          title: t("filum.messaggi.very_dense_fill"),
          detail: t("filum.messaggi.row_spacing_rowspacing_mm_can", { rowSpacing: st.rowSpacing }),
          at: c,
          fix: { label: t("filum.messaggi.set_0_25_mm_ink"), apply: (x) => (x.stitch.type === "fill" ? { ...x, stitch: { ...x.stitch, rowSpacing: 0.25 } } : x) },
        });
      }
    }
    if (st.type === "running" && st.length < 1) {
      add({
        level: "warning",
        title: t("filum.messaggi.very_short_running_stitches"),
        detail: t("filum.messaggi.stitches_under_1_mm_tend"),
        at: c,
        fix: { label: t("filum.messaggi.set_1_5_mm"), apply: (x) => (x.stitch.type === "running" ? { ...x, stitch: { ...x.stitch, length: 1.5 } } : x) },
      });
    }
    // shape geometry (Ink/Stitch troubleshoot)
    for (const pr of shapeProblemsCached(o)) add({ level: pr.level, title: pr.title, detail: pr.detail, at: pr.at ?? c });
    const lg = longestOf(index);
    if (lg && lg.len > 8 && st.type !== "satin") {
      add({ level: "warning", title: t("filum.messaggi.long_stitches"), detail: t("filum.messaggi.contains_a_v1_mm_stitch", { v1: lg.len.toFixed(1) }), at: lg.at });
    }
  });
  const total = plan?.stats.stitches ?? 0;
  if (total > 100000) out.push({ id: "big", objId: "", level: "info", title: t("filum.messaggi.very_large_design"), detail: t("filum.messaggi.v1_stitches", { v1: total.toLocaleString() }), at: [hw / 2, hh / 2] });
  // NOVAstitch: the modules' checks (module 0's registry), after Filum's own
  out.push(...moduleIssues(doc, plan));
  cache.set(doc, { plan, checks: issueChecksVersion(), issues: out });
  return out;
}
