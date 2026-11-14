import { FontPickerDialog } from "./Lettering";
import { RouteDialog } from "./RouteDialog";
import { KnockdownDialog } from "./KnockdownDialog";
import { CrossStitchDialog } from "./CrossStitchAssistant";
import { CalibrateDialog } from "./CalibrateDialog";
import { TestSwatchesDialog } from "./TestSwatches";
import { LicensesDialog } from "./Licenses";
import { OutlineDialog, RepeatDialog } from "./ArrangeTools";
import { ConvertDialog } from "./ConvertTools";
import { useState } from "react";
import { CommandPalette } from "./CommandPalette";
import { useStore } from "../store";
// NOVAstitch: the About window is module 0's (nova/core/about), with LICENSE and NOTICE
import { AboutDialog } from "../nova/core/about";
export { AboutDialog };
import { Dialog } from "./ui";
import { DigitizeDialog } from "./DigitizeDialog";
import { ThreadListDialog } from "./ThreadListDialog";
import { RebuildShapesDialog } from "./RebuildShapes";
import { PrintDialog } from "./PrintDialog";
import { ExportDialog } from "./ExportDialog";
import { SettingsDialog } from "./SettingsDialog";
import { ThreadManager } from "./ThreadManager";
import { ShapeEffectsDialog } from "./ShapeEffects";
import { t } from "../nova/i18n/filum";

// ---------------------------------------------------------------------------
// Threads

// ---------------------------------------------------------------------------
// Machine settings

// ---------------------------------------------------------------------------

/** Keyboard shortcuts, by what they act on. */
const SHORTCUTS = (): { group: string; rows: [string, string][] }[] => [
  {
    group: t("filum.finestre.everywhere_group"),
    rows: [
      ["Ctrl+K", t("filum.finestre.command_palette_find_any_command")],
      ["Ctrl+Z / Ctrl+Shift+Z", t("filum.finestre.undo_redo")],
      ["Ctrl+N / Ctrl+O / Ctrl+S", t("filum.finestre.new_open_save_shift_save")],
      ["Ctrl+I / Ctrl+E / Ctrl+P", t("filum.finestre.import_export_embroidery_print")],
      ["Ctrl+,", t("filum.finestre.preferences")],
      ["?", t("filum.finestre.keyboard_shortcuts")],
    ],
  },
  {
    group: t("filum.finestre.tools_group"),
    rows: [
      ["V / A / C / H / M", t("filum.finestre.select_edit_nodes_cutter_pan")],
      ["P / F / S", t("filum.finestre.pen_running_stitch_freehand_satin")],
      ["U", t("filum.finestre.curvature_click_points_the_path")],
      ["R / E / T", t("filum.finestre.rectangle_ellipse_lettering_click_to")],
      ["G", t("filum.finestre.gradient_drag_across_a_shape")],
      [t("filum.finestre.key_density_blend"), t("filum.finestre.drag_across_a_fill_dense")],
      ["D", t("filum.finestre.stitch_direction_draw_guide_lines")],
      ["B", t("filum.finestre.shape_builder_drag_across_overlaps")],
      ["Esc", t("filum.finestre.back_to_select_or_clear")],
    ],
  },
  {
    group: t("filum.finestre.view_group"),
    rows: [
      ["1 / 2 / 3", t("filum.finestre.vector_stitch_realistic_view")],
      ["4", t("filum.finestre.finished_piece_without_the_jump")],
      ["0 / Shift+0", t("filum.finestre.fit_hoop_fit_design")],
      [t("filum.finestre.key_wheel_pinch"), t("filum.finestre.zoom_at_the_cursor")],
      [t("filum.finestre.space_drag_middle_mouse"), t("filum.finestre.pan")],
      ["Shift+D", t("filum.finestre.density_map")],
    ],
  },
  {
    group: t("filum.finestre.stitch_out_player_group"),
    rows: [
      [t("filum.finestre.animate_bottom_bar"), t("filum.finestre.open_the_player_and_play")],
      ["← / →", t("filum.finestre.one_stitch_back_forward")],
      [t("filum.finestre.shift_shift"), t("filum.finestre.previous_next_colour_block")],
      ["Home / End", t("filum.finestre.to_the_start_the_end")],
      [t("filum.finestre.click_or_drag_the_timeline"), t("filum.finestre.go_to_that_stitch")],
      [t("filum.finestre.ctrl_wheel_on_the_timeline"), t("filum.finestre.zoom_the_timeline")],
      ["Esc", t("filum.finestre.close_the_player")],
    ],
  },
  {
    group: t("filum.finestre.selection_objects_group"),
    rows: [
      ["Ctrl+A", t("filum.finestre.select_all_node_tool_every")],
      ["Ctrl+X / Ctrl+C / Ctrl+V", t("filum.finestre.cut_copy_paste_objects_also")],
      ["Ctrl+] / Ctrl+[", t("filum.finestre.sew_later_earlier_shift_last")],
      ["Ctrl+3 / Ctrl+Alt+3", t("filum.finestre.hide_the_selection_show_all")],
      ["Ctrl+2 / Ctrl+Alt+2", t("filum.finestre.lock_the_selection_unlock_all")],
      [t("filum.finestre.right_click"), t("filum.finestre.the_commands_for_what_is")],
      [t("filum.finestre.ctrl_d_alt_d_del"), t("filum.finestre.duplicate_linked_clone_delete")],
      [t("filum.finestre.arrows_shift"), t("filum.finestre.nudge_0_5_mm_5")],
      ["Ctrl+G / Ctrl+Shift+G", t("filum.finestre.group_ungroup_groups_nest_group")],
      ["Ctrl+J", t("filum.finestre.join_close_an_open_path")],
      ["Ctrl+Alt+J", t("filum.finestre.average_the_selected_points_onto")],
      ["Ctrl+8 / Ctrl+Alt+Shift+8", t("filum.finestre.make_release_a_compound_path")],
      ["Ctrl+Shift+C / Ctrl+Shift+V", t("filum.finestre.copy_paste_stitch_properties")],
      [t("filum.finestre.key_with_a_selection"), t("filum.finestre.rotate_the_fill_angle_5")],
      [t("filum.finestre.double_click_an_object"), t("filum.finestre.edit_its_nodes_lettering_edit")],
      [t("filum.finestre.ctrl_click"), t("filum.finestre.pick_one_object_inside_a")],
      [t("filum.finestre.drag_a_path_segment_node"), t("filum.finestre.bend_the_curve_a_click")],
    ],
  },
  {
    group: t("filum.finestre.transform_group"),
    rows: [
      [t("filum.finestre.alt_drag_an_object"), t("filum.finestre.move_a_copy")],
      [t("filum.finestre.shift_while_dragging"), t("filum.finestre.constrain_rotation_in_15_steps")],
      [t("filum.finestre.scale_handles"), t("filum.finestre.free_shift_keep_proportions_alt")],
      [t("filum.finestre.rotate"), t("filum.finestre.drag_just_outside_a_corner")],
      [t("filum.finestre.ctrl_drag_a_side_handle"), t("filum.finestre.skew_shift_15_steps")],
      [t("filum.finestre.ctrl_while_dragging"), t("filum.finestre.ignore_smart_guides")],
    ],
  },
  {
    group: t("filum.finestre.pen_satin_group"),
    rows: [
      [t("filum.finestre.click_drag"), t("filum.finestre.corner_point_smooth_point_with")],
      [t("filum.finestre.while_drawing"), t("filum.finestre.drag_points_and_handles_click")],
      [t("filum.finestre.click_an_end_of_a"), t("filum.finestre.continue_drawing_that_path")],
      [t("filum.finestre.satin_scroll_or"), t("filum.finestre.width_of_the_next_point")],
      [t("filum.finestre.enter_esc_backspace"), t("filum.finestre.finish_the_path_the_tool")],
      [t("filum.finestre.freehand"), t("filum.finestre.the_line_trails_the_pointer")],
      [t("filum.finestre.pen"), t("filum.finestre.points_snap_to_existing_points")],
      [t("filum.finestre.cutter"), t("filum.finestre.click_a_line_to_split")],
    ],
  },
  {
    group: t("filum.finestre.node_tool_group"),
    rows: [
      [t("filum.finestre.click_a_segment_alt_click"), t("filum.finestre.add_a_point_a_rung")],
      [t("filum.finestre.click_shift_click_drag_a"), t("filum.finestre.select_points_drag_to_move")],
      [t("filum.finestre.del_shift_del"), t("filum.finestre.delete_the_points_keeping_the")],
      [t("filum.finestre.arrows_shift"), t("filum.finestre.nudge_the_points_0_1")],
      ["Shift+C / S / Y", t("filum.finestre.corner_smooth_symmetric_points")],
      ["Shift+L / U", t("filum.finestre.straight_curved_segments")],
      ["Shift+B / J", t("filum.finestre.break_the_path_at_the")],
      [t("filum.finestre.alt_drag_a_handle"), t("filum.finestre.break_the_symmetry")],
    ],
  },
  {
    group: t("filum.finestre.pictures_lettering_group"),
    rows: [
      [t("filum.finestre.drop_or_paste_a_picture"), t("filum.finestre.choose_a_reference_to_trace")],
      [t("filum.finestre.double_click_a_reference"), t("filum.finestre.adjust_it_enter_done_del")],
      [t("filum.finestre.lettering_handles"), t("filum.finestre.drag_the_arch_handle_to")],
    ],
  },
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const match = (r: [string, string]) => words.every((w) => (r[0] + " " + r[1]).toLowerCase().includes(w));
  const groups = SHORTCUTS().map((g) => ({ ...g, rows: g.rows.filter(match) })).filter((g) => g.rows.length);
  return (
    <Dialog wide title={t("filum.finestre.keyboard_shortcuts")} onClose={onClose}>
      <input className="input" style={{ width: "100%", marginBottom: 10 }} placeholder={t("filum.finestre.filter_shortcuts")} value={q} autoFocus onChange={(e) => setQ(e.target.value)} aria-label={t("filum.finestre.filter_shortcuts_2")} />
      <div className="shortcut-groups">
        {groups.map((g) => (
          <section key={g.group}>
            <h4>{g.group}</h4>
            <table className="shortcuts">
              <tbody>
                {g.rows.map(([k, v]) => (
                  <tr key={k + v}>
                    <td>
                      <kbd>{k}</kbd>
                    </td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        {!groups.length && <p className="hint">{t("filum.finestre.no_shortcut_matches_q", { q })}</p>}
      </div>
    </Dialog>
  );
}

export function Dialogs() {
  const dialog = useStore((s) => s.dialog);
  const close = () => useStore.getState().setDialog(null);
  switch (dialog) {
    case "route":
      return <RouteDialog onClose={close} />;
    case "knockdown":
      return <KnockdownDialog onClose={close} />;
    case "palette":
      return <CommandPalette onClose={close} />;
    case "export":
      return <ExportDialog onClose={close} />;
    case "digitize":
      return <DigitizeDialog onClose={close} />;
    case "fonts":
      return <FontPickerDialog onClose={close} />;
    case "threads":
      return <ThreadManager onClose={close} />;
    case "settings":
      return <SettingsDialog onClose={close} />;
    case "production":
      return <PrintDialog onClose={close} />;
    case "threadlist":
      return <ThreadListDialog onClose={close} />;
    case "rebuild":
      return <RebuildShapesDialog onClose={close} />;
    case "shortcuts":
      return <ShortcutsDialog onClose={close} />;
    case "about":
      return <AboutDialog onClose={close} />;
    case "licenses":
      return <LicensesDialog onClose={close} />;
    case "repeat":
      return <RepeatDialog onClose={close} />;
    case "outline":
      return <OutlineDialog onClose={close} />;
    case "convert":
      return <ConvertDialog onClose={close} />;
    case "effects":
      return <ShapeEffectsDialog onClose={close} />;
    case "swatches":
      return <TestSwatchesDialog onClose={close} />;
    case "calibrate":
      return <CalibrateDialog onClose={close} />;
    case "crossstitch":
      return <CrossStitchDialog onClose={close} />;
    default:
      return null;
  }
}
