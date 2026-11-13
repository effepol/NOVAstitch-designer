import { MoveHorizontal, Route, SlidersHorizontal } from "lucide-react";
import { Digitize, Fabric as FabricIcon, Hoop, PullCompensation, RowSpacing, SewOrder, Spool, StitchAngle, StitchFill, StitchLength, StitchRunning, StitchSatin, Underlay } from "../icons/stitch";
import { TOOL_ICONS } from "../icons/toolIcons";
import { autoRouteSatins, autoRouteSelection } from "../lib/autoRoute";
import { openRoute } from "./RouteDialog";
import { textOnPath } from "../lib/textOps";
import { GradientToolBar, ShapeToolBar } from "./ToolOptions";
import { ArrangeButtons } from "./ArrangeTools";
import { BuilderToolBar, GuidesToolBar, NodeToolBar, ToolOptionsBar } from "./ToolOptions";
import { TextBar, useSelectedTextGroup } from "./Lettering";
import { ConvertMenuButton } from "./ConvertTools";
import { ArrowLeftRight, Circle, CircleCheck, Import, Layers3 } from "lucide-react";
import { importFile, optimizeOrder } from "../lib/actions";
import { normAngle } from "../lib/geometry";
import { FABRICS } from "../lib/materials";
import { HOOP_GROUPS, HOOPS, hoopIndex, hoopOf } from "../lib/hoops";
import { chooseHoop, hoopGroups, useHoopGroups } from "../nova/core/hoopChoice";
import type { Hoop as DocHoop } from "../types";
import { useStore } from "../store";
import type { Fabric, StitchType, Tool } from "../types";
import { Num } from "./ui";
import { t } from "../nova/i18n/filum";

/** NOVAstitch: the value a hoop picker shows: a module's hoop ("user:<id>", nova.hoopRef), a preset index, or -1 (custom). */
export function hoopValue(hoop: DocHoop, ref: { id: string } | null | undefined): string {
  if (ref && hoopGroups().some((g) => g.list().some((h) => h.id === ref.id))) return `user:${ref.id}`;
  return String(hoopIndex(hoop));
}

/** NOVAstitch: a hoop picked in a picker, through chooseHoop (module a writes nova.hoopRef and nova.hoopKind). */
export function pickHoopOption(value: string) {
  const commit = useStore.getState().commit;
  if (value.startsWith("user:")) {
    const id = value.slice(5);
    const h = hoopGroups().flatMap((g) => g.list()).find((x) => x.id === id);
    if (h) chooseHoop({ source: "user", id }, () => commit((d) => ({ ...d, hoop: { name: h.name, width: h.width, height: h.height, ...(h.shape && h.shape !== "rect" ? { shape: h.shape } : {}) } })));
    return;
  }
  const h = HOOPS[+value];
  if (h) chooseHoop({ source: "preset", id: `hoops:${h.name}` }, () => commit((d) => ({ ...d, hoop: hoopOf(h) })));
}

/** Hoop presets grouped by brand (option values are indices into HOOPS), then the modules' groups (values "user:<id>"). */
export function HoopOptions() {
  useHoopGroups();
  return (
    <>
      {hoopGroups().map((g) => (
        <optgroup key={g.id} label={t(g.label)} data-nova={g.module}>
          {g.list().map((h) => (
            <option key={h.id} value={`user:${h.id}`} title={t("filum.barre.width_height_mm_width_height", { width: h.width, height: h.height })}>
              {h.name}
            </option>
          ))}
        </optgroup>
      ))}
      {HOOP_GROUPS.map((g) => (
        <optgroup key={g} label={g}>
          {HOOPS.map((h, i) =>
            h.brand === g ? (
              <option key={h.name} value={i} title={t("filum.barre.width_height_mm_width_height", { width: h.width, height: h.height })}>
                {h.name}
              </option>
            ) : null,
          )}
        </optgroup>
      ))}
    </>
  );
}

export { FABRICS } from "../lib/materials";

export function TitleBar() {
  const doc = useStore((s) => s.doc);
  const saved = useStore((s) => s.saved);
  const setDialog = useStore((s) => s.setDialog);
  const hoopVal = hoopValue(doc.hoop, doc.nova?.hoopRef);
  return (
    <div className="titlebar">
      <input className="docname" value={doc.name} onChange={(e) => useStore.getState().liveUpdate((d) => ({ ...d, name: e.target.value }))} spellCheck={false} aria-label={t("filum.barre.design_name")} />
      <span className={`saved ${saved ? "" : "dirty"}`}>
        {saved ? <CircleCheck size={13} /> : <Circle size={11} />}
        {saved ? t("filum.barre.saved") : t("filum.barre.edited")}
      </span>
      <label className="sel-icon" title={t("filum.barre.fabric_adjusts_density_and_underlay")}>
        <FabricIcon size={14} />
        <select
          className="select"
          aria-label={t("filum.barre.fabric_preset")}
          title={t("filum.barre.fabric_adjusts_density_and_underlay")}
          value={doc.fabric}
          onChange={(e) => useStore.getState().setFabric(e.target.value as Fabric)}
        >
          {FABRICS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <label className="sel-icon" title={t("filum.barre.hoop_name_width_height_mm", { name: doc.hoop.name, width: doc.hoop.width, height: doc.hoop.height })}>
        <Hoop size={14} />
        <select
          className="select"
          aria-label={t("filum.barre.hoop")}
          title={t("filum.barre.hoop_name_width_height_mm", { name: doc.hoop.name, width: doc.hoop.width, height: doc.hoop.height })}
          value={hoopVal !== "-1" ? hoopVal : "custom"}
          onChange={(e) => pickHoopOption(e.target.value)}
        >
          {hoopVal === "-1" && <option value="custom">{t("filum.barre.width_height_mm", { width: doc.hoop.width, height: doc.hoop.height })}</option>}
          <HoopOptions />
        </select>
      </label>
      <div className="spacer" />
      <button className="btn ghost" onClick={optimizeOrder} title={t("filum.barre.reorder_to_minimise_colour_changes")}>
        <SewOrder size={14} />{t("filum.barre.optimise")}
      </button>
      <button className="btn primary" onClick={() => setDialog("export")}>
        {t("filum.barre.export")}
      </button>
    </div>
  );
}

const TYPES: { id: StitchType; icon: React.ReactNode; title: string }[] = [
  { id: "running", icon: <StitchRunning size={14} />, get title() { return t("filum.barre.running_stitch"); } },
  { id: "satin", icon: <StitchSatin size={14} />, get title() { return t("filum.barre.satin_column"); } },
  { id: "fill", icon: <StitchFill size={14} />, get title() { return t("filum.barre.fill"); } },
];

export function ContextBar() {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const updateStitch = useStore((s) => s.updateStitch);
  const textGroup = useSelectedTextGroup();
  const tool = useStore((s) => s.tool);
  // the stitch count follows the plan as it is recomputed
  useStore((s) => s.plan);
  if (tool === "pen" || tool === "freehand" || tool === "satin") return <ToolOptionsBar tool={tool} />;
  if (tool === "curve") return <ToolOptionsBar tool="pen" />;
  if (tool === "gradient") return <GradientToolBar />;
  if (tool === "node") return <NodeToolBar />;
  if (tool === "builder") return <BuilderToolBar />;
  if (tool === "guides") return <GuidesToolBar />;
  if (tool === "rect") return <ShapeToolBar />;
  if (textGroup) return <TextBar group={textGroup} />;
  const sel = doc.objects.filter((o) => selection.includes(o.id));
  if (!sel.length) return <div className="contextbar">{t("filum.barre.select_an_object_to_edit")}</div>;
  if (sel.length > 1)
    return (
      <div className="contextbar">
        <span className="obj-name">
          <Layers3 size={14} />
          <span>{t("filum.barre.sel_objects_selected", { sel: sel.length })}</span>
        </span>
        <div className="vsep" />
        <ArrangeButtons count={sel.length} />
        <div className="vsep" />
        {sel.some((o) => o.text) && sel.some((o) => !o.text) && (
          <>
            <button
              className="btn sm"
              title={t("filum.barre.lay_the_lettering_along_the")}
              onClick={() => {
                void textOnPath().then((err) => err && useStore.getState().toast(err, "error"));
              }}
            >
              {t("filum.barre.text_on_path")}
            </button>
            <div className="vsep" />
          </>
        )}
        {sel.some((o) => o.stitch.type === "satin") && sel.every((o) => o.stitch.type === "satin" || o.stitch.type === "running") && <AutoSatinBar />}
        {sel.every((o) => o.stitch.type === "running") && (
          <>
            <button
              className="btn sm"
              title={t("filum.barre.auto_route_join_the_lines")}
              onClick={() => {
                const err = autoRouteSelection();
                if (err) useStore.getState().toast(err, "error");
              }}
            >
              <Route size={13} />{t("filum.barre.auto_route")}
            </button>
            <button
              className="btn sm ghost"
              title={t("filum.barre.redwork_every_line_sewn_exactly")}
              onClick={() => {
                const err = autoRouteSelection(true);
                if (err) useStore.getState().toast(err, "error");
              }}
            >
              {t("filum.barre.redwork")}
            </button>
            <div className="vsep" />
          </>
        )}
        <ConvertMenuButton objects={sel} />
        <div className="seg" role="group" aria-label={t("filum.barre.stitch_type")}>
          {TYPES.map((ty) => (
            <button
              key={ty.id}
              title={t("filum.barre.make_all_v1", { v1: ty.title.toLowerCase() })}
              className={sel.every((o) => o.stitch.type === ty.id) ? "on" : ""}
              onClick={() => {
                useStore.getState().checkpoint();
                for (const o of sel) useStore.getState().updateStitch(o.id, { type: ty.id }, true);
              }}
            >
              {ty.icon}
            </button>
          ))}
        </div>
      </div>
    );
  const o = sel[0];
  const st = o.stitch;
  const thread = doc.threads.find((t) => t.id === o.thread);
  return (
    <div className="contextbar">
      <span className="obj-name">
        <span className="swatch" style={{ background: thread?.color }} />
        <span>{o.name}</span>
      </span>
      <div className="seg" role="group" aria-label={t("filum.barre.stitch_type")}>
        {TYPES.map((t) => (
          <button key={t.id} title={t.title} className={st.type === t.id ? "on" : ""} onClick={() => updateStitch(o.id, { type: t.id })}>
            {t.icon}
          </button>
        ))}
      </div>
      {st.type === "fill" && (
        <>
          <label className="ctx-field" title={t("filum.barre.fill_angle")}>
            <StitchAngle size={13} />
            <span className="sr-only">{t("filum.barre.fill_angle")}</span>
            <Num value={st.angle} onChange={(v) => updateStitch(o.id, { angle: normAngle(v) })} unit="°" step={5} digits={1} />
          </label>
          <label className="ctx-field" title={t("filum.barre.row_spacing")}>
            <RowSpacing size={13} />
            <span className="sr-only">{t("filum.barre.row_spacing")}</span>
            <Num value={st.rowSpacing} onChange={(v) => updateStitch(o.id, { rowSpacing: v })} unit="mm" step={0.05} min={0.1} />
          </label>
          <div className="vsep" />
          <div className="seg" title={st.underlayAuto ? t("filum.barre.underlay_automatic_by_the_shape") : t("filum.barre.underlay")}>
            <button
              className={st.underlay || st.underlayAuto ? "on" : ""}
              onClick={() => updateStitch(o.id, st.underlay || st.underlayAuto ? { underlay: false, underlayAuto: false } : { underlay: true })}
            >
              <Underlay size={13} />{t("filum.barre.underlay_2")}
            </button>
          </div>
        </>
      )}
      {st.type === "satin" && (
        <>
          {o.paths.length === 1 && (
            <label className="ctx-field" title={t("filum.barre.column_width")}>
              <MoveHorizontal size={13} />
              <span className="sr-only">{t("filum.barre.column_width")}</span>
              <Num value={st.width} onChange={(v) => updateStitch(o.id, { width: v })} unit="mm" step={0.2} min={0.5} max={12} />
            </label>
          )}
          <label className="ctx-field" title={t("filum.barre.zig_zag_spacing")}>
            <RowSpacing size={13} />
            <span className="sr-only">{t("filum.barre.zig_zag_spacing")}</span>
            <Num value={st.spacing} onChange={(v) => updateStitch(o.id, { spacing: v })} unit="mm" step={0.05} min={0.1} />
          </label>
          <label className="ctx-field" title={t("filum.barre.pull_compensation")}>
            <PullCompensation size={13} />
            <span className="sr-only">{t("filum.barre.pull_compensation")}</span>
            <Num value={st.pullComp} onChange={(v) => updateStitch(o.id, { pullComp: v })} unit="mm" step={0.05} />
          </label>
          <button
            className={`icon-btn ${st.reverse ? "on" : ""}`}
            title={st.reverse ? t("filum.barre.direction_reversed_click_to_restore") : t("filum.barre.reverse_direction")}
            aria-pressed={!!st.reverse}
            onClick={() => updateStitch(o.id, { reverse: !st.reverse })}
          >
            <ArrowLeftRight size={14} />
          </button>
        </>
      )}
      {st.type === "running" && (
        <>
          <label className="ctx-field" title={t("filum.barre.stitch_length")}>
            <StitchLength size={13} />
            <span className="sr-only">{t("filum.barre.stitch_length")}</span>
            <Num value={st.length} onChange={(v) => updateStitch(o.id, { length: v })} unit="mm" step={0.1} min={0.5} max={6} />
          </label>
          <div className="seg" title={t("filum.barre.passes_along_the_line")}>
            <button className={st.beanRepeats < 2 ? "on" : ""} title={t("filum.barre.single_running_stitch")} onClick={() => updateStitch(o.id, { beanRepeats: 0 })}>
              {t("filum.barre.run")}
            </button>
            <button className={st.beanRepeats >= 2 && st.beanRepeats < 4 ? "on" : ""} title={t("filum.barre.triple_bean_stitch")} onClick={() => updateStitch(o.id, { beanRepeats: 2 })}>
              {t("filum.barre.triple")}
            </button>
            <button className={st.beanRepeats >= 4 ? "on" : ""} title={t("filum.barre.five_passes_very_bold_line")} onClick={() => updateStitch(o.id, { beanRepeats: 4 })}>
              {t("filum.barre.heavy")}
            </button>
          </div>
        </>
      )}
      <ConvertMenuButton objects={sel} />
      <div className="spacer" />
      <span className="stat">{statFor(o.id)}</span>
    </div>
  );
}

function statFor(id: string) {
  const s = useStore.getState();
  const idx = s.doc.objects.findIndex((o) => o.id === id);
  const plan = s.plan;
  if (!plan || idx < 0) return "";
  let n = 0;
  for (let i = 0; i < plan.objects.length; i++) if (plan.objects[i] === idx && !(plan.flags[i] & 31)) n++;
  return `${n.toLocaleString()} stitches`;
}

const RAIL: ({ tool: Tool; title: string } | "-")[] = [
  { tool: "select", get title() { return t("filum.barre.select_v"); } },
  { tool: "pan", get title() { return t("filum.barre.pan_h_space"); } },
  { tool: "ruler", get title() { return t("filum.barre.ruler_m"); } },
  { tool: "node", get title() { return t("filum.barre.edit_nodes_a"); } },
  { tool: "cut", get title() { return t("filum.barre.cutter_c_click_a_line"); } },
  "-",
  { tool: "pen", get title() { return t("filum.barre.pen_p_click_for_corners"); } },
  { tool: "curve", get title() { return t("filum.barre.curvature_u_click_points_the"); } },
  { tool: "freehand", get title() { return t("filum.barre.freehand_f"); } },
  { tool: "satin", get title() { return t("filum.barre.satin_column_s_click_drag"); } },
  { tool: "guides", get title() { return t("filum.barre.stitch_direction_d_drag_across"); } },
  { tool: "rect", get title() { return t("filum.barre.rectangle_r"); } },
  { tool: "ellipse", get title() { return t("filum.barre.ellipse_e"); } },
  "-",
  { tool: "text", get title() { return t("filum.barre.lettering_t_click_to_place"); } },
  { tool: "gradient", get title() { return t("filum.barre.gradient_g_colour_gradients_density"); } },
  { tool: "builder", get title() { return t("filum.barre.shape_builder_b_drag_across"); } },
];

function RailButton({ tool, title, on, onClick }: { tool: Tool; title: string; on: boolean; onClick: () => void }) {
  const Icon = TOOL_ICONS[tool];
  return (
    <button className={`icon-btn ${on ? "on" : ""}`} title={title} aria-pressed={on} onClick={onClick}>
      <Icon size={17} />
    </button>
  );
}

export function ToolRail() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const setDialog = useStore((s) => s.setDialog);
  return (
    <nav className="toolrail" aria-label={t("filum.barre.tools")}>
      {RAIL.map((t, i) => (t === "-" ? <div className="grp-sep" key={i} /> : <RailButton key={t.tool} tool={t.tool} title={t.title} on={tool === t.tool} onClick={() => setTool(t.tool)} />))}
      <div className="grp-sep" />
      <button className="icon-btn" title={t("filum.barre.import_artwork_or_embroidery_file")} onClick={importFile}>
        <Import size={17} />
      </button>
      <button className="icon-btn" title={t("filum.barre.digitize_a_picture")} onClick={() => setDialog("digitize")}>
        <Digitize size={17} />
      </button>
      <button className="icon-btn" title={t("filum.barre.thread_colours")} onClick={() => setDialog("threads")}>
        <Spool size={17} />
      </button>
    </nav>
  );
}

/** Auto-route satin columns: the quick button (the options are in Path ▸ Route). */
function AutoSatinBar() {
  return (
    <>
      <button
        className="btn sm"
        title={t("filum.barre.auto_route_satins_one_sewing")}
        onClick={() => {
          const err = autoRouteSatins();
          if (err) useStore.getState().toast(err, "error");
        }}
      >
        <Route size={13} />{t("filum.barre.auto_route_satins")}
      </button>
      <button className="icon-btn" title={t("filum.barre.options_trim_keep_order_keep")} onClick={() => openRoute("satin")}>
        <SlidersHorizontal size={14} />
      </button>
      <div className="vsep" />
    </>
  );
}
