// Every command of the application, once: the menu bar shows them as menus
// with submenus, the command palette (Ctrl+K) searches the same list. Each
// command has one home, chosen by what it acts on:
//
//   File     the document and files (open, import, digitize a picture, save, export)
//   Edit     undo, the clipboard, selection, preferences
//   Object   arranging objects (align, mirror, repeat, group, combine)
//   Path     the geometry of shapes (effects, nodes, conversions, routing)
//   Stitch   how shapes are sewn (appliqué, gradients, cross stitch, design-wide sewing options)
//   Threads  colours and palettes
//   View     what the canvas shows, panels, theme
//   Tools    the drawing and editing tools
//   Help

import { AlignCenterHorizontal, ArrowDownUp, Clipboard, SquareSplitHorizontal, ArrowRightLeft, Blend, ClipboardPaste, Combine, Copy, CopyPlus, Eye, EyeOff, FileCode, FileDown, FilePlus, FlipHorizontal2, FlipVertical2, Flower2, FolderOpen, Grid2x2Check, Group, ImagePlus, Import, Link2, Lock, LockOpen, Mountain, Printer, Redo2, RotateCw, Route, Ruler, Scissors, Settings, Spline, Trash2, Undo2, Ungroup, Unlink, Wand2, ZoomIn, ZoomOut, type LucideIcon } from "lucide-react";
import { Applique, Basting, Rebuild, StitchAngle, Cutwork, DensityMap, Digitize, GradientTool, Hoop, Jump, Knockdown, PatchBorder, SewOrder, Spool, StitchCross, StitchRunning, StitchSatin } from "../icons/stitch";
import { TOOL_ICONS } from "../icons/toolIcons";
import { unlinkClone } from "../lib/clones";
import { centerInHoop, cloneSelection, exportDesign, fit, importFile, newDocument, openDigitizer, openDocument, optimizeOrder, saveDocument, selectAll } from "../lib/actions";
import {
  align,
  copyProperties,
  copySelection,
  distribute,
  groupSelection,
  hasClipboard,
  hasCopiedProperties,
  hideSelection,
  lockSelection,
  makeApplique,
  mirrorSelection,
  orderSelection,
  pasteClipboard,
  pasteProperties,
  combineShapes,
  rotateSelection,
  selectSimilar,
  showAll,
  ungroupSelection,
  unlockAll,
} from "../lib/arrange";
import { applies } from "../lib/convertActions";
import { exportTarget, PICTURE_SETTINGS } from "../lib/exportFiles";
import { defaultDesignOptions } from "../lib/geometry";
import { openExternal, openFile } from "../lib/platform";
import { addReference } from "../lib/references";
import { divideSelection } from "../lib/shapeBuilder";
import { cleanupDocument } from "../lib/shapeCheck";
import { DEFAULT_LAYOUT } from "../lib/layout";
import { showDesign, showIssues, togglePanels } from "../lib/panelActions";
import { reversePath, sharpen } from "../lib/shapeOps";
import { chartLabel, exportPalette, fitThreads, importPalette, matchAll, mergeSimilarColours, mergeTolerance, removeUnused, revertFit, sortBySewOrder, STITCH_COLORS } from "../lib/threads";
import { loadSample } from "../sample";
import { useStore } from "../store";
import type { Tool, ViewMode } from "../types";
import { CONVERSIONS, openConvert } from "./ConvertTools";
import { openKnockdown } from "./KnockdownDialog";
import { openRoute } from "./RouteDialog";
import { runCutwork } from "./CutworkPanel";
import { EFFECTS, lineAsFillGuide, openEffect, pathCommand } from "./ShapeEffects";
import { chooseThreadList } from "./ThreadListDialog";
import { lastChart } from "./ThreadPicker";
import { compoundSelection, joinSelection, releaseSelection } from "../lib/pathActions";
import { averageSelectedNodes } from "../lib/nodeActions";
import { menuItems } from "../nova/core/registry";
import { inEnglish, t, tn } from "../nova/i18n/filum";

/** The name of a menu on screen: Filum's own menus are translated, a module's new menu shows its own name. */
export const menuName = (name: string) => {
  const key = `filum.menu.top.${name}`;
  const text = t(key);
  return text === key ? name : text;
};

/** NOVAstitch (rule i.3): the module that added a menu, for menus Filum does not have. */
const addedMenus = new Map<string, string>();
export const menuOwner = (name: string): string | undefined => addedMenus.get(name);

/** Filum's menus with the registered items: each menu's own after a separator, new menus before Help. */
function withRegisteredItems(menus: Record<string, MenuItem[]>): Record<string, MenuItem[]> {
  const items = menuItems();
  addedMenus.clear();
  if (!items.length) return menus;
  const out: Record<string, MenuItem[]> = {};
  const added = (name: string): MenuItem[] =>
    items
      .filter((i) => i.menu === name)
      .map((i) => ({ label: t(i.label), kbd: i.kbd, hint: i.hint ? t(i.hint) : undefined, run: i.run, checked: i.checked?.(), disabled: i.disabled?.(), nova: i.module }));
  const fresh = [...new Set(items.map((i) => i.menu))].filter((m) => !(m in menus));
  for (const m of fresh) addedMenus.set(m, items.find((i) => i.menu === m)!.module);
  for (const [name, list] of Object.entries(menus)) {
    if (name === "Help") for (const m of fresh) out[m] = added(m);
    const more = added(name);
    out[name] = more.length ? [...list, "-", ...more] : list;
  }
  if (!("Help" in menus)) for (const m of fresh) out[m] = added(m);
  return out;
}

export type MenuItem =
  | {
      label: string;
      kbd?: string;
      run?: () => void;
      checked?: boolean;
      disabled?: boolean;
      /** What it does (tooltip, palette). */
      hint?: string;
      /** Shown in the menus and the command palette. */
      icon?: LucideIcon;
      /** A submenu. */
      sub?: MenuItem[];
      /** NOVAstitch (rule i.3): the module that registered it (data-nova on the item). */
      nova?: string;
    }
  | "-";

export type MenuEntry = Exclude<MenuItem, "-">;


/** Zoom around the middle of the canvas. */
export function zoomBy(f: number) {
  const s = useStore.getState();
  const el = document.querySelector(".canvas-wrap")?.getBoundingClientRect();
  if (!el) return;
  const mx = el.width / 2;
  const my = el.height / 2;
  const scale = Math.max(0.3, Math.min(400, s.view.scale * f));
  const k = scale / s.view.scale;
  s.setView({ scale, ox: mx - (mx - s.view.ox) * k, oy: my - (my - s.view.oy) * k });
}

export const mod = navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl+";

/** Put text on the system clipboard (best effort: menus can't use the copy event). */
const clipboardWrite = (text: string | null) => {
  if (text) navigator.clipboard?.writeText(text).catch(() => {});
};

async function addReferencePicture() {
  const f = await openFile([{ name: t("filum.menu.pictures"), extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"] }]);
  if (f) await addReference(f.name, f.bytes);
}

/** The application's menus, for the current state. */
export function buildMenus(): Record<string, MenuItem[]> {
  const s = useStore.getState();
  const hasSel = s.selection.length > 0;
  const many = s.selection.length > 1;
  const selected = s.doc.objects.filter((o) => s.selection.includes(o.id));
  const selObj = selected[0];
  const oneFill = s.selection.length === 1 && selObj?.stitch.type === "fill";
  const opts = s.doc.options ?? defaultDesignOptions();
  const setOpts = (p: Partial<typeof opts>) => s.commit((d) => ({ ...d, options: { ...(d.options ?? defaultDesignOptions()), ...p } }));
  const tool = (t: Tool, label: string, kbd: string, hint?: string): MenuItem => ({ label, kbd, hint, icon: TOOL_ICONS[t], run: () => s.setTool(t), checked: s.tool === t });
  const mode = (m: ViewMode, label: string, kbd: string): MenuItem => ({ label, kbd, run: () => s.setViewMode(m), checked: s.viewMode === m });
  const toggle = (label: string, on: boolean, flip: () => void, kbd?: string, hint?: string): MenuItem => ({ label, kbd, hint, run: flip, checked: on });
  const gradient = (m: "blend" | "density", toast: string) => () => {
    s.setToolOptions("gradient", { mode: m });
    s.setTool("gradient");
    s.toast(toast);
  };

  // NOVAstitch: the items modules registered (nova/core/registry) go in after Filum's own
  return withRegisteredItems({
    File: [
      { label: t("filum.menu.new_design"), icon: FilePlus, kbd: `${mod}N`, run: newDocument },
      { label: t("filum.menu.open"), icon: FolderOpen, kbd: `${mod}O`, run: openDocument },
      { label: t("filum.menu.load_sample_design"), icon: Mountain, run: loadSample },
      "-",
      { label: t("filum.menu.import_artwork_or_embroidery"), icon: Import, kbd: `${mod}I`, run: importFile, hint: t("filum.menu.svg_artwork_machine_files_dst") },
      { label: t("filum.menu.digitize_a_picture"), icon: Digitize, run: () => openDigitizer("shapes"), hint: t("filum.menu.turn_a_picture_into_fills") },
      { label: t("filum.menu.cross_stitch_from_a_picture"), icon: StitchCross, run: () => openDigitizer("cross"), hint: t("filum.menu.turn_a_picture_into_cross") },
      { label: t("filum.menu.add_reference_picture"), icon: ImagePlus, run: () => void addReferencePicture(), hint: t("filum.menu.a_picture_to_trace_over") },
      "-",
      { label: t("filum.menu.save"), kbd: `${mod}S`, run: () => saveDocument() },
      { label: t("filum.menu.save_as"), kbd: `${mod}⇧S`, run: () => saveDocument(true) },
      "-",
      { label: t("filum.menu.export_embroidery"), icon: FileDown, kbd: `${mod}E`, run: () => s.setDialog("export") },
      { label: t("filum.menu.export_ink_stitch_svg"), icon: FileCode, run: () => exportDesign("svg") },
      { label: t("filum.menu.print_pdf"), icon: Printer, kbd: `${mod}P`, run: () => s.setDialog("production") },
    ],
    Edit: [
      { label: t("filum.menu.undo"), icon: Undo2, kbd: `${mod}Z`, run: s.undo, disabled: !s.past.length },
      { label: t("filum.menu.redo"), icon: Redo2, kbd: `${mod}⇧Z`, run: s.redo, disabled: !s.future.length },
      "-",
      { label: t("filum.menu.cut"), icon: Scissors, kbd: `${mod}X`, run: () => clipboardWrite(copySelection(true)), disabled: !hasSel },
      { label: t("filum.menu.copy"), icon: Copy, kbd: `${mod}C`, run: () => clipboardWrite(copySelection()), disabled: !hasSel },
      { label: t("filum.menu.paste"), icon: ClipboardPaste, kbd: `${mod}V`, run: () => pasteClipboard(), disabled: !hasClipboard() },
      { label: t("filum.menu.paste_in_place"), icon: Clipboard, run: () => pasteClipboard(true), disabled: !hasClipboard() },
      "-",
      { label: t("filum.menu.duplicate"), icon: CopyPlus, kbd: `${mod}D`, run: s.duplicateSelection, disabled: !hasSel },
      { label: t("filum.menu.clone_linked_copy"), icon: Link2, kbd: "Alt+D", run: cloneSelection, disabled: !hasSel },
      {
        label: t("filum.menu.unlink_clone"),
        icon: Unlink,
        run: () => s.commit((d) => ({ ...d, objects: d.objects.map((o) => (s.selection.includes(o.id) && o.clone ? unlinkClone(o) : o)) })),
        disabled: !selected.some((o) => o.clone),
      },
      { label: t("filum.menu.delete"), icon: Trash2, kbd: t("filum.menu.key_del"), run: s.deleteSelection, disabled: !hasSel },
      "-",
      { label: t("filum.menu.select_all"), kbd: `${mod}A`, run: selectAll },
      {
        label: t("filum.menu.select_same"),
        disabled: !hasSel,
        sub: [
          { label: t("filum.menu.colour"), run: () => selectSimilar("color"), disabled: !hasSel },
          { label: t("filum.menu.stitch_type"), run: () => selectSimilar("type"), disabled: !hasSel },
        ],
      },
      {
        label: t("filum.menu.stitch_properties"),
        disabled: !hasSel,
        sub: [
          { label: t("filum.menu.copy"), kbd: `${mod}⇧C`, run: copyProperties, disabled: !hasSel },
          { label: t("filum.menu.paste"), kbd: `${mod}⇧V`, run: () => pasteProperties(false), disabled: !hasSel || !hasCopiedProperties() },
          { label: t("filum.menu.paste_with_colour"), run: () => pasteProperties(true), disabled: !hasSel || !hasCopiedProperties() },
        ],
      },
      "-",
      { label: t("filum.menu.preferences"), icon: Settings, kbd: `${mod},`, run: () => s.openSettings() },
    ],
    Object: [
      {
        label: t("filum.menu.align"),
        icon: AlignCenterHorizontal,
        disabled: !hasSel,
        sub: [
          { label: many ? t("filum.menu.left") : t("filum.menu.left_in_hoop"), run: () => align("left"), disabled: !hasSel },
          { label: t("filum.menu.centre_horizontally"), run: () => align("hcenter"), disabled: !hasSel },
          { label: many ? t("filum.menu.right") : t("filum.menu.right_in_hoop"), run: () => align("right"), disabled: !hasSel },
          "-",
          { label: many ? t("filum.menu.top") : t("filum.menu.top_in_hoop"), run: () => align("top"), disabled: !hasSel },
          { label: t("filum.menu.centre_vertically"), run: () => align("vcenter"), disabled: !hasSel },
          { label: many ? t("filum.menu.bottom") : t("filum.menu.bottom_in_hoop"), run: () => align("bottom"), disabled: !hasSel },
          "-",
          { label: t("filum.menu.distribute_horizontally"), run: () => distribute("h"), disabled: s.selection.length < 3 },
          { label: t("filum.menu.distribute_vertically"), run: () => distribute("v"), disabled: s.selection.length < 3 },
        ],
      },
      { label: t("filum.menu.centre_in_hoop"), icon: Hoop, run: centerInHoop, hint: t("filum.menu.the_selection_or_the_whole") },
      {
        label: t("filum.menu.stitch_order"),
        icon: ArrowDownUp,
        disabled: !hasSel,
        sub: [
          { label: t("filum.menu.sew_last_to_front"), kbd: `${mod}⇧]`, run: () => orderSelection("front"), disabled: !hasSel },
          { label: t("filum.menu.sew_later"), kbd: `${mod}]`, run: () => orderSelection("forward"), disabled: !hasSel },
          { label: t("filum.menu.sew_earlier"), kbd: `${mod}[`, run: () => orderSelection("backward"), disabled: !hasSel },
          { label: t("filum.menu.sew_first_to_back"), kbd: `${mod}⇧[`, run: () => orderSelection("back"), disabled: !hasSel },
        ],
      },
      "-",
      {
        label: t("filum.menu.rotate"),
        icon: RotateCw,
        disabled: !hasSel,
        sub: [
          { label: t("filum.menu.n90_clockwise"), run: () => rotateSelection(90), disabled: !hasSel },
          { label: t("filum.menu.n90_counter_clockwise"), run: () => rotateSelection(-90), disabled: !hasSel },
          { label: "180°", run: () => rotateSelection(180), disabled: !hasSel },
        ],
      },
      { label: t("filum.menu.mirror_horizontally"), icon: FlipHorizontal2, run: () => mirrorSelection("h"), disabled: !hasSel },
      { label: t("filum.menu.mirror_vertically"), icon: FlipVertical2, run: () => mirrorSelection("v"), disabled: !hasSel },
      { label: t("filum.menu.repeat_wreath_kaleidoscope_mirror_merge"), icon: Flower2, run: () => s.setDialog("repeat"), disabled: !hasSel },
      "-",
      { label: t("filum.menu.group"), icon: Group, kbd: `${mod}G`, run: groupSelection, disabled: !many },
      { label: t("filum.menu.ungroup"), icon: Ungroup, kbd: `${mod}⇧G`, run: ungroupSelection, disabled: !hasSel },
      "-",
      { label: t("filum.menu.hide"), icon: EyeOff, kbd: `${mod}3`, run: hideSelection, disabled: !hasSel, hint: t("filum.menu.hidden_objects_are_not_sewn") },
      { label: t("filum.menu.show_all"), icon: Eye, kbd: `${mod}Alt+3`, run: showAll, disabled: !s.doc.objects.some((o) => !o.visible) },
      { label: t("filum.menu.lock"), icon: Lock, kbd: `${mod}2`, run: lockSelection, disabled: !hasSel, hint: t("filum.menu.locked_objects_can_t_be") },
      { label: t("filum.menu.unlock_all"), icon: LockOpen, kbd: `${mod}Alt+2`, run: unlockAll, disabled: !s.doc.objects.some((o) => o.locked) },
      "-",
      {
        label: t("filum.menu.combine_shapes"),
        icon: Combine,
        sub: [
          { label: t("filum.menu.unite"), run: () => combineShapes("unite"), disabled: !many },
          { label: t("filum.menu.minus_front"), run: () => combineShapes("minusFront"), disabled: !many },
          { label: t("filum.menu.intersect"), run: () => combineShapes("intersect"), disabled: !many },
          { label: t("filum.menu.exclude"), run: () => combineShapes("exclude"), disabled: !many },
          "-",
          { label: t("filum.menu.divide_into_regions"), icon: SquareSplitHorizontal, run: () => void divideSelection(), disabled: !many },
          tool("builder", t("filum.menu.shape_builder"), "B", t("filum.menu.merge_or_delete_the_overlap")),
        ],
      },
    ],
    Path: [
      { label: t("filum.menu.effects"), icon: Wand2, disabled: !hasSel, sub: EFFECTS.map((e): MenuItem => ({ label: `${e.label}…`, hint: e.title, run: () => openEffect(e.id), disabled: !hasSel })) },
      { label: t("filum.menu.outlines_offsets"), icon: PatchBorder, run: () => s.setDialog("outline"), disabled: !hasSel },
      { label: t("filum.menu.join"), kbd: `${mod}J`, run: joinSelection, disabled: !hasSel, hint: t("filum.menu.close_an_open_path_or") },
      {
        label: t("filum.menu.compound_path"),
        disabled: !hasSel,
        sub: [
          { label: t("filum.menu.make"), kbd: `${mod}8`, run: compoundSelection, disabled: !many, hint: t("filum.menu.the_paths_of_the_selected") },
          { label: t("filum.menu.release"), kbd: `${mod}Alt+⇧8`, run: releaseSelection, disabled: !hasSel, hint: t("filum.menu.every_path_of_an_object") },
        ],
      },
      {
        label: t("filum.menu.nodes"),
        icon: Spline,
        disabled: !hasSel,
        sub: [
          { label: t("filum.menu.make_all_corners_sharp"), run: () => pathCommand(sharpen, t("filum.menu.corners_sharpened")), disabled: !hasSel },
          { label: t("filum.menu.average_points"), kbd: `${mod}Alt+J`, run: averageSelectedNodes, disabled: s.tool !== "node" || s.nodeSel.length < 2, hint: t("filum.menu.move_the_selected_points_onto") },
          { label: t("filum.menu.reverse_path_direction"), run: () => pathCommand(reversePath, t("filum.menu.reversed")), disabled: !hasSel },
        ],
      },
      "-",
      {
        label: t("filum.menu.convert"),
        icon: ArrowRightLeft,
        sub: [
          ...CONVERSIONS.map((c): MenuItem => ({ label: c.menu, hint: c.title, run: () => openConvert(c.id), disabled: !applies(c.id, selected) })),
          "-",
          { label: t("filum.menu.rebuild_shapes_from_stitches"), icon: Rebuild, run: () => s.setDialog("rebuild"), disabled: !hasSel },
        ],
      },
      {
        label: t("filum.menu.route"),
        icon: Route,
        sub: [
          { label: t("filum.menu.auto_route_running_stitch"), icon: StitchRunning, run: () => openRoute("running"), disabled: !selected.some((o) => o.stitch.type === "running"), hint: t("filum.menu.also_out_and_back_redwork") },
          { label: t("filum.menu.auto_route_satin_columns"), icon: StitchSatin, run: () => openRoute("satin"), disabled: !selected.some((o) => o.stitch.type === "satin") },
          { label: t("filum.menu.jumps_to_running_stitch"), icon: Jump, run: () => openRoute("jumps") },
        ],
      },
      { label: t("filum.menu.cutwork_segmentation"), icon: Cutwork, run: () => runCutwork(s.selection), disabled: !selected.some((o) => o.stitch.type === "running") },
      { label: t("filum.menu.use_line_as_fill_guide"), icon: StitchAngle, run: lineAsFillGuide, disabled: s.selection.length !== 2, hint: t("filum.menu.select_a_fill_and_a") },
    ],
    Stitch: [
      { label: t("filum.menu.make_applique"), icon: Applique, run: makeApplique, disabled: !hasSel },
      { label: t("filum.menu.knockdown"), icon: Knockdown, run: () => openKnockdown(), hint: t("filum.menu.a_net_that_flattens_pile") },
      { label: t("filum.menu.cross_stitch_shapes"), icon: StitchCross, run: () => s.setDialog("crossstitch"), disabled: !selected.some((o) => o.stitch.type === "fill") },
      {
        label: t("filum.menu.gradient"),
        icon: GradientTool,
        disabled: !oneFill,
        sub: [
          { label: t("filum.menu.colour_blending"), icon: Blend, run: gradient("blend", t("filum.menu.drag_across_the_shape_this")), disabled: !oneFill },
          { label: t("filum.menu.density_gradient"), icon: DensityMap, run: gradient("density", t("filum.menu.drag_across_the_shape_dense")), disabled: !oneFill },
        ],
      },
      tool("guides", t("filum.menu.stitch_direction"), "D", t("filum.menu.draw_guide_lines_the_rows")),
      { label: t("filum.menu.test_swatches"), icon: Grid2x2Check, run: () => s.setDialog("swatches"), disabled: !hasSel },
      { label: t("filum.menu.calibrate_fabric"), icon: Ruler, run: () => s.setDialog("calibrate"), hint: t("filum.menu.sew_a_swatch_measure_it") },
      "-",
      {
        label: t("filum.menu.basting"),
        icon: Basting,
        sub: [
          { label: t("filum.menu.none"), run: () => setOpts({ basting: "none" }), checked: opts.basting === "none" },
          { label: t("filum.menu.box_around_the_design"), run: () => setOpts({ basting: "box" }), checked: opts.basting === "box" },
          { label: t("filum.menu.following_the_design"), run: () => setOpts({ basting: "contour" }), checked: opts.basting === "contour" },
        ],
      },
      { label: t("filum.menu.optimise_stitch_order"), icon: SewOrder, run: optimizeOrder, hint: t("filum.menu.fewer_colour_changes_jumps_and") },
      "-",
      toggle(t("filum.menu.remove_hidden_stitching"), !!opts.removeOverlaps, () => setOpts({ removeOverlaps: !opts.removeOverlaps }), undefined, t("filum.menu.leave_out_what_lies_under")),
      toggle(t("filum.menu.show_hidden_stitching"), s.showHidden, () => s.set({ showHidden: !s.showHidden }), undefined, t("filum.menu.mark_what_is_left_out")),
      {
        label: t("filum.menu.clean_up_tiny_objects"),
        run: () => {
          const n = cleanupDocument(s.commit, s.doc);
          s.toast(n ? tn("filum.menu.removed_tiny_objects", n) : t("filum.menu.nothing_to_clean_up"));
        },
      },
      { label: t("filum.menu.troubleshoot"), run: () => showIssues(), hint: t("filum.menu.the_issues_panel") },
    ],
    Threads: [
      { label: t("filum.menu.thread_colours"), icon: Spool, run: () => s.setDialog("threads") },
      "-",
      {
        label: t("filum.menu.fit_design_to_my_threads"),
        run: async () => {
          const r = await fitThreads({ kind: "mine" });
          if (!r) return s.toast(t("filum.menu.my_threads_is_empty_add"));
          s.toast(`${t("filum.menu.fitted_threads", { n: r.fitted })}${r.shared ? t("filum.menu.fitted_sharing_a_spool", { n: r.shared }) : ""}${r.far.length ? t("filum.menu.fitted_without_a_close_spool", { n: r.far.length }) : ""}`, r.far.length ? "info" : "success");
        },
      },
      {
        label: t("filum.menu.revert_fitted_colours"),
        run: () => {
          const n = revertFit();
          s.toast(n ? tn("filum.menu.threads_back_to_original", n) : t("filum.menu.no_fitted_threads"));
        },
        disabled: !Object.keys(s.doc.threadSources ?? {}).length,
      },
      { label: t("filum.menu.match_all_to_chart", { chart: chartLabel(lastChart()) }), run: async () => s.toast(t("filum.menu.matched_threads_to_chart", { n: await matchAll(lastChart()), chart: chartLabel(lastChart()) }), "success") },
      "-",
      { label: t("filum.menu.merge_similar_colours", { tolerance: mergeTolerance() }), run: mergeSimilarColours, hint: t("filum.menu.threads_this_close_share_a") },
      {
        label: t("filum.menu.remove_unused_threads"),
        run: () => {
          const n = removeUnused();
          s.toast(n ? tn("filum.menu.removed_unused_threads", n) : t("filum.menu.every_thread_is_in_use"));
        },
      },
      { label: t("filum.menu.sort_threads_by_sew_order"), run: sortBySewOrder },
      "-",
      {
        label: t("filum.menu.palette"),
        sub: [
          { label: t("filum.menu.import_gpl"), run: async () => s.toast(t("filum.menu.added_threads", { n: await importPalette() })) },
          { label: t("filum.menu.export_gpl"), run: () => exportPalette() },
        ],
      },
      {
        label: t("filum.menu.thread_list"),
        sub: [
          { label: t("filum.menu.apply_txt_col_edr_inf"), run: chooseThreadList },
          { label: t("filum.menu.export_txt"), run: () => exportTarget("threadlist", {}, PICTURE_SETTINGS, s.doc.name || "design"), disabled: !s.doc.objects.length },
        ],
      },
    ],
    View: [
      mode("vector", t("filum.menu.vector"), "1"),
      mode("stitch", t("filum.menu.stitches"), "2"),
      mode("realistic", t("filum.menu.realistic"), "3"),
      { label: t("filum.menu.finished_piece"), kbd: "4", run: () => s.set({ finished: !s.finished }), checked: s.finished, hint: t("filum.menu.the_jump_threads_you_snip") },
      "-",
      {
        label: t("filum.menu.show"),
        sub: [
          toggle(t("filum.menu.jump_stitches"), s.showJumps, () => s.set({ showJumps: !s.showJumps })),
          toggle(t("filum.menu.underlay"), s.showUnderlay, () => s.set({ showUnderlay: !s.showUnderlay })),
          toggle(t("filum.menu.grid"), s.showGrid, () => s.set({ showGrid: !s.showGrid })),
          {
            label: t("filum.menu.grid_spacing"),
            sub: [
              { label: t("filum.menu.automatic_5_10_mm"), run: () => s.set({ gridStep: 0, showGrid: true }), checked: !s.gridStep },
              ...[1, 2, 2.5, 5, 10].map((g): MenuItem => ({ label: `${g} mm`, run: () => s.set({ gridStep: g, showGrid: true }), checked: s.gridStep === g })),
              ...(s.gridStep && ![1, 2, 2.5, 5, 10].includes(s.gridStep) ? [{ label: t("filum.menu.gridstep_mm_cross_stitch_cells", { gridStep: s.gridStep }), checked: true, run: () => {} } as MenuItem] : []),
            ],
          },
          toggle(t("filum.menu.density_map"), s.showDensity, () => s.set({ showDensity: !s.showDensity }), "⇧D"),
        ],
      },
      {
        label: t("filum.menu.stitch_colours"),
        sub: [
          ...STITCH_COLORS.map((c): MenuItem => ({ label: c.label, hint: c.title, run: () => s.set({ stitchColors: c.id }), checked: s.stitchColors === c.id })),
          "-",
          { label: t("filum.menu.only_the_active_colour"), run: () => s.set({ colorFocus: !s.colorFocus }), checked: s.colorFocus, disabled: !s.activeThread },
        ],
      },
      {
        label: t("filum.menu.snapping"),
        sub: [
          toggle(t("filum.menu.smart_guides"), s.smartGuides, () => s.set({ smartGuides: !s.smartGuides }), undefined, t("filum.menu.snap_to_other_objects_and")),
          toggle(t("filum.menu.snap_to_points"), s.prefs.snapPoints, () => s.setPrefs({ snapPoints: !s.prefs.snapPoints }), undefined, t("filum.menu.pen_and_node_tool_points")),
        ],
      },
      "-",
      { label: t("filum.menu.zoom_in"), icon: ZoomIn, kbd: "+", run: () => zoomBy(1.25) },
      { label: t("filum.menu.zoom_out"), icon: ZoomOut, kbd: "−", run: () => zoomBy(0.8) },
      "-",
      { label: t("filum.menu.fit_hoop"), kbd: "0", run: () => fit("hoop") },
      { label: t("filum.menu.fit_design"), kbd: "⇧0", run: () => fit("design") },
      { label: t("filum.menu.actual_size"), run: () => fit(1) },
      "-",
      {
        label: t("filum.menu.panels"),
        sub: [
          toggle(t("filum.menu.layers_panel"), s.layout.showOutline, () => s.setLayout({ showOutline: !s.layout.showOutline }), undefined, t("filum.menu.layers_and_issues")),
          toggle(t("filum.menu.properties_panel"), s.layout.showInspector, () => s.setLayout({ showInspector: !s.layout.showInspector }), undefined, t("filum.menu.the_selection_s_and_the")),
          { label: s.layout.showOutline || s.layout.showInspector ? t("filum.menu.hide_panels") : t("filum.menu.show_panels"), kbd: `${mod}\\`, run: togglePanels, hint: t("filum.menu.more_room_for_the_canvas") },
          "-",
          { label: t("filum.menu.issues"), run: () => showIssues(), checked: s.layout.showOutline && s.outlineTab === "issues" },
          { label: t("filum.menu.design_settings"), run: () => showDesign(), checked: s.layout.showInspector && s.inspectorTab === "design" },
          "-",
          { label: t("filum.menu.layers_on_the_left"), run: () => s.setLayout({ outlineSide: "left" }), checked: s.layout.outlineSide === "left", hint: t("filum.menu.layers_left_of_the_canvas") },
          { label: t("filum.menu.layers_above_properties"), run: () => s.setLayout({ outlineSide: "right" }), checked: s.layout.outlineSide === "right", hint: t("filum.menu.both_panels_on_the_right") },
          { label: t("filum.menu.reset_panel_layout"), run: () => s.setLayout({ ...DEFAULT_LAYOUT }) },
        ],
      },
      {
        label: t("filum.menu.theme"),
        sub: [
          { label: t("filum.menu.light"), run: () => s.setTheme("light"), checked: s.theme === "light" },
          { label: t("filum.menu.dark"), run: () => s.setTheme("dark"), checked: s.theme === "dark" },
        ],
      },
      toggle(t("filum.menu.shortcut_hints"), s.prefs.hints, () => s.setPrefs({ hints: !s.prefs.hints })),
    ],
    Tools: [
      tool("select", t("filum.menu.select"), "V"),
      tool("pan", t("filum.menu.pan"), "H"),
      tool("ruler", t("filum.menu.ruler"), "M"),
      tool("node", t("filum.menu.edit_nodes"), "A"),
      tool("cut", t("filum.menu.cutter"), "C"),
      "-",
      tool("pen", t("filum.menu.pen"), "P"),
      tool("curve", t("filum.menu.curvature"), "U"),
      tool("freehand", t("filum.menu.freehand"), "F"),
      tool("satin", t("filum.menu.satin_column"), "S"),
      tool("rect", t("filum.menu.rectangle"), "R"),
      tool("ellipse", t("filum.menu.ellipse"), "E"),
      tool("text", t("filum.menu.lettering"), "T"),
      "-",
      tool("gradient", t("filum.menu.gradient"), "G"),
      tool("guides", t("filum.menu.stitch_direction"), "D"),
      tool("builder", t("filum.menu.shape_builder"), "B"),
    ],
    Help: [
      { label: t("filum.menu.command_palette"), kbd: `${mod}K`, run: () => s.setDialog("palette"), hint: t("filum.menu.find_any_command_by_name") },
      { label: t("filum.menu.keyboard_shortcuts"), kbd: "?", run: () => s.setDialog("shortcuts") },
      { label: t("filum.menu.ink_stitch_documentation"), run: () => void openExternal("https://inkstitch.org/docs/") },
      "-",
      { label: t("filum.menu.optional_downloads"), run: () => s.openSettings("downloads"), hint: t("filum.menu.fonts_and_thread_charts_filum") },
      { label: t("filum.menu.licences"), run: () => s.setDialog("licenses") },
      { label: t("filum.menu.about_filum"), run: () => s.setDialog("about") },
    ],
  });
}

/** Every runnable command with its menu path (for the command palette). */
export function flattenMenus(menus: Record<string, MenuItem[]>): { path: string[]; item: MenuEntry }[] {
  const out: { path: string[]; item: MenuEntry }[] = [];
  const walk = (items: MenuItem[], path: string[]) => {
    for (const it of items) {
      if (it === "-") continue;
      if (it.sub) walk(it.sub, [...path, it.label]);
      else if (it.run) out.push({ path, item: it });
    }
  };
  for (const [name, items] of Object.entries(menus)) walk(items, [name]);
  return out;
}

/** The canvas's right-click menu: the commands for what was clicked, taken from the menus. */
export function contextMenu(onObject: boolean): MenuItem[] {
  const menus = buildMenus();
  const find = (menu: string, ...labels: string[]): MenuItem[] => {
    const out: MenuItem[] = [];
    for (const label of labels) {
      const it = menus[menu]?.find((x) => x !== "-" && inEnglish(x.label).includes(label));
      if (it) out.push(it);
    }
    return out;
  };
  if (!onObject)
    return [
      ...find("Edit", "Paste", "Paste in place"),
      "-",
      ...find("Edit", "Select all"),
      "-",
      ...find("Object", "Show all", "Unlock all"),
      "-",
      ...find("View", "Fit hoop", "Fit design"),
      "-",
      ...find("File", "Add reference picture…", "Digitize a picture…"),
    ];
  return [
    ...find("Edit", "Cut", "Copy", "Paste", "Duplicate", "Delete"),
    "-",
    ...find("Object", "Stitch order", "Align", "Rotate", "Mirror horizontally", "Mirror vertically"),
    "-",
    ...find("Object", "Group", "Ungroup", "Hide", "Lock"),
    "-",
    ...find("Edit", "Select same", "Stitch properties"),
    "-",
    ...find("Path", "Convert"),
  ];
}
