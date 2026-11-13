// Context bar while a drawing tool is active: what the tool will create and
// how it behaves.

import { AlignHorizontalJustifyCenter, Combine, AlignVerticalJustifyCenter, CircleDashed, Hexagon, Link2, PenLine, PenTool, Scissors, Spline, Square, Star, Trash2 } from "lucide-react";
import { MoveHorizontal } from "lucide-react";
import { GradientTool, StitchAngle, StitchLength, StitchSatin } from "../icons/stitch";
import { alignSelected, breakNodes, deleteNodes, joinSelected, nodeType, segmentType, toggleClosedSelected } from "../lib/nodeActions";
import { combineShapes } from "../lib/arrange";
import { divideSelection, builderTargets } from "../lib/shapeBuilder";
import { RAMP_PROFILES, rampMembers, rampOf, removeRamp, selectedRamp, updateRamp } from "../lib/ramp";
import { useStore } from "../store";
import { is2D, selectedGradient } from "../lib/gradient";
import { GradientBarCompact, KindPicker, RowStylePicker } from "./GradientPanel";
import { Num } from "./ui";
import { GuideActions } from "./SatinGuides";
import { t, tn } from "../nova/i18n/filum";

type DrawTool = "pen" | "freehand" | "satin";

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string, string?][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([id, text, title]) => (
        <button key={id} className={value === id ? "on" : ""} title={title} onClick={() => onChange(id)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function ToolOptionsBar({ tool }: { tool: DrawTool }) {
  const opts = useStore((s) => s.toolOptions);
  const set = useStore((s) => s.setToolOptions);
  if (tool === "pen")
    return (
      <div className="contextbar">
        <span className="obj-name">
          <PenTool size={14} />
          <span>{t("filum.barre.pen")}</span>
        </span>
        <Seg
          label={t("filum.barre.stitch")}
          value={opts.pen.stitch}
          options={[
            ["running", t("filum.barre.run"), t("filum.barre.single_running_stitch")],
            ["triple", t("filum.barre.triple"), t("filum.barre.triple_bean_stitch_bold_outlines")],
          ]}
          onChange={(v) => set("pen", { stitch: v })}
        />
        <label className="ctx-field" title={t("filum.barre.stitch_length")}>
          <StitchLength size={13} />
          <span className="sr-only">{t("filum.barre.stitch_length")}</span>
          <Num value={opts.pen.length} unit="mm" step={0.1} min={0.5} max={8} onChange={(v) => set("pen", { length: v })} />
        </label>
        <span className="ctx-label">{t("filum.barre.closed_shapes")}</span>
        <Seg
          label={t("filum.barre.closed_shapes")}
          value={opts.pen.closed}
          options={[
            ["run", t("filum.barre.outline"), t("filum.barre.a_closed_path_stays_a")],
            ["fill", t("filum.barre.fill"), t("filum.barre.a_closed_path_becomes_a")],
          ]}
          onChange={(v) => set("pen", { closed: v })}
        />
        <span className="ctx-help">{t("filum.barre.drag_for_curves_alt_breaks")}</span>
      </div>
    );
  if (tool === "freehand")
    return (
      <div className="contextbar">
        <span className="obj-name">
          <PenLine size={14} />
          <span>{t("filum.barre.freehand")}</span>
        </span>
        <Seg
          label={t("filum.barre.output")}
          value={opts.freehand.output}
          options={[
            ["running", t("filum.barre.run")],
            ["triple", t("filum.barre.triple")],
            ["satin", "Satin", t("filum.barre.a_satin_column_along_the")],
          ]}
          onChange={(v) => set("freehand", { output: v })}
        />
        {opts.freehand.output === "satin" && (
          <label className="ctx-field" title={t("filum.barre.column_width")}>
            <MoveHorizontal size={13} />
            <span className="sr-only">{t("filum.barre.column_width")}</span>
            <Num value={opts.freehand.width} unit="mm" step={0.1} min={0.5} max={12} onChange={(v) => set("freehand", { width: v })} />
          </label>
        )}
        <label className="ctx-field ctx-slider" title={t("filum.barre.stabiliser_the_line_trails_the")}>
          {t("filum.barre.smoothing")}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opts.freehand.smoothing}
            onChange={(e) => set("freehand", { smoothing: +e.target.value })}
          />
          <span className="ctx-val">{Math.round(opts.freehand.smoothing * 100)}%</span>
        </label>
        <label className="ctx-field" title={t("filum.barre.curve_fitting_turns_sharper_than")}>
          {t("filum.barre.corners")}
          <Num value={opts.freehand.corners ?? 65} unit="°" step={5} min={10} max={170} digits={0} onChange={(v) => set("freehand", { corners: v })} />
        </label>
        <label className="ctx-field" title={t("filum.barre.curve_fitting_straight_runs_of")}>
          <input type="checkbox" checked={opts.freehand.lines ?? true} onChange={(e) => set("freehand", { lines: e.target.checked })} />
          {t("filum.barre.lines")}
        </label>
        <span className="ctx-label">{t("filum.barre.loops")}</span>
        <Seg
          label={t("filum.barre.closed_loops")}
          value={opts.freehand.closed}
          options={[
            ["run", t("filum.barre.outline")],
            ["fill", t("filum.barre.fill"), t("filum.barre.a_stroke_that_ends_at")],
          ]}
          onChange={(v) => set("freehand", { closed: v })}
        />
        <span className="ctx-help">{t("filum.barre.the_result_is_a_clean")}</span>
      </div>
    );
  return (
    <div className="contextbar">
      <span className="obj-name">
        <StitchSatin size={14} />
        <span>{t("filum.barre.satin_column")}</span>
      </span>
      <label className="ctx-field" title={t("filum.barre.width_of_the_next_point")}>
        <MoveHorizontal size={13} />
        <span className="sr-only">{t("filum.barre.width_of_the_next_point")}</span>
        <Num value={opts.satin.width} unit="mm" step={0.1} min={0.3} max={15} onChange={(v) => set("satin", { width: v })} />
      </label>
      <span className="ctx-help">
        {t("filum.barre.drag_for_curves_scroll_over")}
      </span>
    </div>
  );
}

/** Context bar of the gradient tool. */
export function GradientToolBar() {
  useStore((s) => s.selection);
  useStore((s) => s.doc);
  const mode = useStore((s) => s.toolOptions.gradient.kind);
  const setOpts = useStore((s) => s.setToolOptions);
  const sg = selectedGradient();
  const kind = sg?.params.kind;
  const gmode = useStore((s) => s.toolOptions.gradient.mode) ?? "colour";
  const ramped = selectedRamp();
  const modeSeg = (
    <div className="seg" role="group" aria-label={t("filum.barre.gradient_type")}>
      {(
        [
          ["colour", t("filum.barre.colour"), t("filum.barre.multi_colour_gradients_with_dithering")],
          ["density", t("filum.barre.density"), t("filum.barre.gradient_fill_one_colour_dense")],
          ["blend", t("filum.barre.blend"), t("filum.barre.colour_blending_this_colour_fades")],
        ] as const
      ).map(([id, label, title]) => (
        <button key={id} title={title} className={gmode === id ? "on" : ""} onClick={() => setOpts("gradient", { mode: id })}>
          {label}
        </button>
      ))}
    </div>
  );
  if (ramped || gmode !== "colour") return <RampToolBar modeSeg={modeSeg} />;
  const help =
    kind === "mesh"
      ? "Click inside to add mesh lines (on a line: one crossing line) · drag nodes · Shift-click to select several · Alt-click / Del removes lines · pick a thread to colour the selection"
      : kind === "freeform"
        ? "Click the shape to add a point · drag points · drag the ring square to set the spread · Alt-click / Del deletes · pick a thread to colour the selection"
        : "Drag the ends · drag stops along the line · click the line to add a stop · Alt-click a stop to remove it";
  return (
    <div className="contextbar">
      <span className="obj-name">
        <GradientTool size={14} />
        <span>{t("filum.barre.gradient")}</span>
      </span>
      {modeSeg}
      {sg ? (
        <>
          <GradientBarCompact group={sg.group} />
          <span className="ctx-help">{help}</span>
        </>
      ) : (
        <>
          <span className="ctx-label">{t("filum.barre.new")}</span>
          <KindPicker value={mode} compact onChange={(k) => setOpts("gradient", { kind: k })} />
          <span className="ctx-help">
            {is2D(mode)
              ? mode === "mesh"
                ? t("filum.barre.click_a_closed_shape_a")
                : t("filum.barre.click_a_closed_shape_freeform")
              : t("filum.barre.select_a_closed_shape_then")}
          </span>
        </>
      )}
    </div>
  );
}

/** Context bar of the rectangle tool: rectangle / polygon / star, corner radius. */
export function ShapeToolBar() {
  const o = useStore((s) => s.toolOptions.shape);
  const set = useStore((s) => s.setToolOptions);
  const up = (p: Partial<typeof o>) => set("shape", p);
  return (
    <div className="contextbar">
      <span className="obj-name">
        <Square size={14} />
        <span>{t("filum.barre.shape")}</span>
      </span>
      <div className="seg">
        {(
          [
            ["rect", t("filum.barre.rectangle"), <Square key="r" size={14} />],
            ["polygon", t("filum.barre.polygon"), <Hexagon key="p" size={14} />],
            ["star", t("filum.barre.star"), <Star key="s" size={14} />],
          ] as const
        ).map(([k, label, icon]) => (
          <button key={k} title={label} className={o.kind === k ? "on" : ""} onClick={() => up({ kind: k })}>
            {icon}
          </button>
        ))}
      </div>
      {o.kind !== "rect" && (
        <label className="ctx-field" title={o.kind === "star" ? t("filum.barre.points") : t("filum.barre.sides")}>
          {o.kind === "star" ? t("filum.barre.points_2") : t("filum.barre.sides_2")}
          <Num value={o.sides} min={3} max={40} step={1} digits={0} onChange={(v) => up({ sides: Math.round(v) })} />
        </label>
      )}
      {o.kind === "star" && (
        <label className="ctx-field" title={t("filum.barre.inner_radius_share_of_the")}>
          {t("filum.barre.inner")}
          <Num value={Math.round(o.inner * 100)} min={5} max={95} step={5} digits={0} unit="%" onChange={(v) => up({ inner: v / 100 })} />
        </label>
      )}
      <label className="ctx-field" title={t("filum.barre.corner_radius_0_sharp")}>
        {t("filum.barre.corners_2")}
        <Num value={o.radius} min={0} max={50} step={0.5} unit="mm" onChange={(v) => up({ radius: Math.max(0, v) })} />
      </label>
      <span className="ctx-help">{t("filum.barre.drag_to_draw_shift_square")}</span>
    </div>
  );
}

/** Small node-type icons (lucide has none for these). */
function NodeIcon({ kind }: { kind: "corner" | "smooth" | "symmetric" | "line" | "curve" }) {
  const st = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      {kind === "corner" && (
        <>
          <path d="M2 13 L8 4 L14 13" {...st} />
          <rect x="6" y="2" width="4" height="4" fill="currentColor" />
        </>
      )}
      {(kind === "smooth" || kind === "symmetric") && (
        <>
          <path d="M2 13 C4 4 12 4 14 13" {...st} />
          <path d={kind === "symmetric" ? "M3 6.3 H13" : "M5 6.3 H14.5"} {...st} strokeWidth={1} />
          <circle cx={kind === "symmetric" ? 8 : 9.5} cy="6.3" r="2" fill="currentColor" />
          <circle cx={kind === "symmetric" ? 3 : 5} cy="6.3" r="1.1" fill="currentColor" />
          <circle cx={kind === "symmetric" ? 13 : 14.5} cy="6.3" r="1.1" fill="currentColor" />
        </>
      )}
      {kind === "line" && (
        <>
          <path d="M3 12 L13 4" {...st} />
          <rect x="1.5" y="10.5" width="3" height="3" fill="currentColor" />
          <rect x="11.5" y="2.5" width="3" height="3" fill="currentColor" />
        </>
      )}
      {kind === "curve" && (
        <>
          <path d="M3 12 C3 4 13 12 13 4" {...st} />
          <rect x="1.5" y="10.5" width="3" height="3" fill="currentColor" />
          <rect x="11.5" y="2.5" width="3" height="3" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

/** Node tool: what the selected points become. */
export function NodeToolBar() {
  const nodeSel = useStore((s) => s.nodeSel);
  const selection = useStore((s) => s.selection);
  const n = nodeSel.length;
  const none = !n;
  const B = ({ title, onClick, children, disabled }: { title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
    <button className="icon-btn" title={title} onClick={onClick} disabled={disabled ?? none}>
      {children}
    </button>
  );
  return (
    <div className="contextbar">
      <span className="obj-name">
        <Spline size={14} />
        <span>{n ? tn("filum.barre.n_points", n) : selection.length ? t("filum.barre.points") : t("filum.barre.edit_nodes")}</span>
      </span>
      <div className="vsep" />
      <B title={t("filum.barre.corner_no_handles_shift_c")} onClick={() => nodeType("corner")}>
        <NodeIcon kind="corner" />
      </B>
      <B title={t("filum.barre.smooth_handles_in_line_shift")} onClick={() => nodeType("smooth")}>
        <NodeIcon kind="smooth" />
      </B>
      <B title={t("filum.barre.symmetric_handles_in_line_and")} onClick={() => nodeType("symmetric")}>
        <NodeIcon kind="symmetric" />
      </B>
      <div className="vsep" />
      <B title={t("filum.barre.straight_segments_between_the_selected")} onClick={() => segmentType("line")}>
        <NodeIcon kind="line" />
      </B>
      <B title={t("filum.barre.curved_segments_between_the_selected")} onClick={() => segmentType("curve")}>
        <NodeIcon kind="curve" />
      </B>
      <div className="vsep" />
      <B title={t("filum.barre.break_the_path_at_the")} onClick={breakNodes}>
        <Scissors size={15} />
      </B>
      <B title={t("filum.barre.join_two_selected_end_points")} onClick={joinSelected} disabled={n !== 2}>
        <Link2 size={15} />
      </B>
      <B title={t("filum.barre.close_the_path_open_it")} onClick={toggleClosedSelected}>
        <CircleDashed size={15} />
      </B>
      <div className="vsep" />
      <B title={t("filum.barre.align_the_selected_points_horizontally")} onClick={() => alignSelected("h")} disabled={n < 2}>
        <AlignVerticalJustifyCenter size={15} />
      </B>
      <B title={t("filum.barre.align_the_selected_points_vertically")} onClick={() => alignSelected("v")} disabled={n < 2}>
        <AlignHorizontalJustifyCenter size={15} />
      </B>
      <div className="vsep" />
      <B title={t("filum.barre.delete_keeping_the_shape_del")} onClick={() => deleteNodes(true)}>
        <Trash2 size={15} />
      </B>
      <span className="ctx-help">
        {n
          ? t("filum.barre.drag_to_move_arrows_nudge")
          : t("filum.barre.click_or_drag_a_box")}
      </span>
    </div>
  );
}

/** Gradient tool, Density / Blend: the ramp of the selection and the defaults for new ones. */
function RampToolBar({ modeSeg }: { modeSeg: React.ReactNode }) {
  useStore((s) => s.doc);
  useStore((s) => s.selection);
  const opts = useStore((s) => s.toolOptions.gradient);
  const set = useStore((s) => s.setToolOptions);
  const o = selectedRamp();
  const r = rampOf(o);
  const members = o ? rampMembers(useStore.getState().doc, o.id) : [];
  const profile = r?.profile ?? opts.profile ?? "linear";
  const dense = r?.dense ?? opts.dense ?? 0.25;
  const sparse = r?.sparse ?? opts.sparse ?? 2;
  // edits go to the selected ramp (and are the defaults for the next one)
  const change = (patch: { profile?: typeof profile; dense?: number; sparse?: number }) => {
    set("gradient", patch);
    if (o) updateRamp(o.id, patch);
  };
  return (
    <div className="contextbar">
      <span className="obj-name">
        <GradientTool size={14} />
        <span>{t("filum.barre.gradient")}</span>
      </span>
      {modeSeg}
      <div className="vsep" />
      <label className="ctx-field" title={t("filum.barre.how_the_density_changes_along")}>
        {t("filum.barre.profile")}
        <select className="select" value={profile} onChange={(e) => change({ profile: e.target.value as typeof profile })}>
          {RAMP_PROFILES.map((p) => (
            <option key={p.id} value={p.id} title={p.hint}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="ctx-field" title={t("filum.barre.row_spacing_where_the_fill")}>
        {t("filum.barre.dense")}
        <Num value={dense} unit="mm" step={0.05} min={0.1} max={2} onChange={(v) => change({ dense: v })} />
      </label>
      <label className="ctx-field" title={t("filum.barre.row_spacing_where_the_fill_2")}>
        {t("filum.barre.open")}
        <Num value={sparse} unit="mm" step={0.1} min={0.3} max={8} onChange={(v) => change({ sparse: v })} />
      </label>
      {o && <RowStylePicker objects={members} />}
      {o && (
        <button className="btn sm ghost" title={t("filum.barre.back_to_a_plain_fill")} onClick={() => removeRamp(o.id)}>
          <Trash2 size={13} />{t("filum.barre.remove")}
        </button>
      )}
      <span className="ctx-help">
        {o
          ? `${members.length > 1 ? t("filum.barre.colour_blend") : t("filum.barre.density_gradient")}${t("filum.barre.gradient_drag_hint")}`
          : opts.mode === "blend"
            ? t("filum.barre.drag_across_a_fill_its")
            : t("filum.barre.drag_across_a_fill_dense")}
      </span>
    </div>
  );
}

/** Boolean icons: two overlapping squares, the result filled. */
function BoolIcon({ op }: { op: "unite" | "minusFront" | "intersect" | "exclude" | "divide" }) {
  const a = "M2 2 H10 V10 H2 Z";
  const b = "M6 6 H14 V14 H6 Z";
  const st = { stroke: "currentColor", strokeWidth: 1.2, fill: "none" };
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      {op === "unite" && <path d="M2 2 H10 V6 H14 V14 H6 V10 H2 Z" fill="currentColor" />}
      {op === "minusFront" && <path d="M2 2 H10 V6 H6 V10 H2 Z" fill="currentColor" />}
      {op === "intersect" && <path d="M6 6 H10 V10 H6 Z" fill="currentColor" />}
      {op === "exclude" && <path d="M2 2 H10 V6 H6 V10 H2 Z M10 6 H14 V14 H6 V10 H10 Z" fill="currentColor" />}
      {op === "divide" && <path d="M2 2 H10 V10 H2 Z M6 6 H14 V14 H6 Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.6 1" />}
      <path d={a} {...st} opacity={op === "divide" ? 0 : 0.6} />
      <path d={b} {...st} opacity={op === "divide" ? 0 : 0.6} />
    </svg>
  );
}

/** Stitch direction: the selected satin's guides — auto at corners, clear. */
export function GuidesToolBar() {
  return (
    <div className="contextbar">
      <span className="ctx-title">
        <StitchAngle size={13} />{t("filum.barre.stitch_direction")}
      </span>
      <GuideActions compact />
      <span className="ctx-help">{t("filum.barre.drag_across_a_satin_to")}</span>
    </div>
  );
}

/** Shape Builder: merge / delete mode, divide and the classic booleans. */
export function BuilderToolBar() {
  useStore((s) => s.selection);
  useStore((s) => s.doc);
  const mode = useStore((s) => s.toolOptions.builder.mode);
  const set = useStore((s) => s.setToolOptions);
  const n = builderTargets().length;
  const ops: [Parameters<typeof combineShapes>[0], string][] = [
    ["unite", t("filum.barre.unite_one_shape_of_all")],
    ["minusFront", t("filum.barre.minus_front_the_bottom_shape")],
    ["intersect", t("filum.barre.intersect_only_where_all_overlap")],
    ["exclude", t("filum.barre.exclude_where_an_odd_number")],
  ];
  return (
    <div className="contextbar">
      <span className="obj-name">
        <Combine size={14} />
        <span>{n ? tn("filum.barre.shape_builder_n", n) : t("filum.barre.shape_builder")}</span>
      </span>
      <div className="seg" role="group" aria-label={t("filum.barre.drag_across_regions_to")}>
        <button className={mode === "merge" ? "on" : ""} title={t("filum.barre.drag_across_regions_to_merge")} onClick={() => set("builder", { mode: "merge" })}>
          {t("filum.barre.merge")}
        </button>
        <button className={mode === "delete" ? "on" : ""} title={t("filum.barre.drag_across_regions_to_delete")} onClick={() => set("builder", { mode: "delete" })}>
          {t("filum.barre.delete")}
        </button>
      </div>
      <div className="vsep" />
      <button className="icon-btn" title={t("filum.barre.divide_every_overlap_region_becomes")} disabled={n < 1} onClick={() => void divideSelection()}>
        <BoolIcon op="divide" />
      </button>
      {ops.map(([op, title]) => (
        <button key={op} className="icon-btn" title={title} disabled={n < 2} onClick={() => void combineShapes(op)}>
          <BoolIcon op={op as "unite"} />
        </button>
      ))}
      <span className="ctx-help">
        {n
          ? t("filum.barre.drag_across_regions_to_merge_2")
          : t("filum.barre.click_a_fill_shift_click")}
      </span>
    </div>
  );
}
