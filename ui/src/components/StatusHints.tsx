// The keys and clicks of the current situation along the bottom: what the
// active tool does now, and — while Shift,
// Ctrl or Alt is held — what that modifier changes.

import { useEffect, useState } from "react";
import { useStore } from "../store";
import { t, tn } from "../nova/i18n/filum";

/** One hint: its keys (mouse: LMB, RMB, MMB, Wheel, Drag) and what it does. */
type Hint = [string[], string];

const mod = typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘" : "Ctrl";

function hintsFor(s: ReturnType<typeof useStore.getState>): Hint[] {
  if (s.dialog) return [[["Esc"], t("filum.barre.close")], [["Drag"], t("filum.barre.move_by_the_title")]];
  if (s.refEdit)
    return [
      [["Drag"], t("filum.barre.move_picture")],
      [["Drag", "corner"], t("filum.barre.scale")],
      [["Shift", "Drag"], t("filum.barre.scale_freely")],
      [["Drag", "knob"], t("filum.barre.rotate")],
      [["Shift", "Drag", "knob"], t("filum.barre.rotate_in_15_steps")],
      [["Arrows"], t("filum.barre.nudge")],
      [["Enter"], t("filum.barre.done")],
      [["Del"], t("filum.barre.remove_picture")],
    ];
  if (s.anim.index != null)
    return [
      [["Drag", "timeline"], t("filum.barre.scrub")],
      [["Ctrl", "Wheel"], t("filum.barre.zoom")],
      [["←", "→"], t("filum.barre.one_stitch")],
      [["Shift", "←", "→"], t("filum.barre.colour_block")],
      [["Home", "End"], t("filum.barre.start_end")],
      [["Esc"], t("filum.barre.close")],
      [["LMB"], t("filum.barre.back_to_editing")],
    ];
  if (s.editingText) return [[["Type"], t("filum.barre.edit_the_text")], [["Enter"], t("filum.barre.new_line")], [["Esc"], t("filum.barre.finish")], [["Drag", "handles"], t("filum.barre.arch_spacing")]];
  const sel = s.selection.length;
  switch (s.tool) {
    case "select":
      return sel
        ? [
            [["Drag"], t("filum.barre.move")],
            [["Alt", "Drag"], t("filum.barre.move_a_copy")],
            [["Shift", "LMB"], t("filum.barre.add_remove")],
            [["Ctrl", "LMB"], t("filum.barre.pick_inside_a_group")],
            [["Drag", "corner"], t("filum.barre.scale")],
            [["Shift", "Drag", "corner"], t("filum.barre.keep_proportions")],
            [["Alt", "Drag", "corner"], t("filum.barre.scale_from_the_centre")],
            [["Ctrl", "Drag", "side"], t("filum.barre.skew")],
            [["Drag", "outside corner"], t("filum.barre.rotate")],
            [["Shift", "Drag", "outside corner"], t("filum.barre.rotate_in_15_steps")],
            [["Ctrl", "Drag"], t("filum.barre.no_smart_guides")],
            [["DblClick"], t("filum.barre.edit_nodes")],
            [["Arrows"], `Nudge ${s.prefs.nudge} mm`],
            [["Shift", "Arrows"], `Nudge ${s.prefs.nudgeBig} mm`],
            [["[", "]"], t("filum.barre.fill_angle_satin_width")],
            [["Del"], t("filum.barre.delete")],
            [[mod, "D"], t("filum.barre.duplicate")],
            [[mod, "G"], t("filum.barre.group")],
          ]
        : [
            [["LMB"], t("filum.barre.select")],
            [["Drag"], t("filum.barre.box_select")],
            [["Shift", "LMB"], t("filum.barre.add_to_the_selection")],
            [["Ctrl", "LMB"], t("filum.barre.pick_inside_a_group")],
            [["DblClick", "picture"], t("filum.barre.adjust_a_reference_picture")],
            [[mod, "A"], t("filum.barre.select_all")],
          ];
    case "node":
      if (!sel) return [[["LMB"], t("filum.barre.choose_a_shape_to_edit")], [["Esc"], t("filum.barre.back_to_select")]];
      return s.nodeSel.length
        ? [
            [["Drag"], `Move ${s.nodeSel.length} point${s.nodeSel.length > 1 ? "s" : ""}`],
            [["Shift", "Drag"], t("filum.barre.straight_only")],
            [["Ctrl", "Drag"], t("filum.barre.no_snapping")],
            [["Shift", "LMB"], t("filum.barre.add_remove_a_point")],
            [["Shift", "Drag"], t("filum.barre.box_add_points")],
            [["Alt", "Drag"], t("filum.barre.box_remove_points")],
            [["Arrows"], `Nudge ${s.prefs.nodeNudge} mm`],
            [["Shift", "Arrows"], `Nudge ${s.prefs.nodeNudgeBig} mm`],
            [["Del"], t("filum.barre.delete_keep_the_shape")],
            [["Shift", "Del"], t("filum.barre.plain_delete")],
            [["Shift", "C"], t("filum.barre.corner")],
            [["Shift", "S"], t("filum.barre.smooth")],
            [["Shift", "Y"], t("filum.barre.symmetric")],
            [["Shift", "L"], t("filum.barre.straight_segments")],
            [["Shift", "U"], t("filum.barre.curved_segments")],
            [["Shift", "B"], t("filum.barre.break")],
            [["Shift", "J"], t("filum.barre.join")],
            [[mod, "Alt", "J"], t("filum.barre.average")],
            [["Esc"], t("filum.barre.deselect_points")],
          ]
        : [
            [["LMB"], t("filum.barre.select_a_point")],
            [["Drag"], t("filum.barre.box_select_points")],
            [["Shift", "Drag"], t("filum.barre.box_add_points")],
            [["LMB", "path"], t("filum.barre.add_a_point")],
            [["Drag", "path"], t("filum.barre.bend_the_curve")],
            [["Alt", "LMB"], t("filum.barre.delete_a_point")],
            [["DblClick"], t("filum.barre.smooth_corner")],
            [["Alt", "Drag", "handle"], t("filum.barre.break_the_handles")],
            [["Drag", "corner widget"], t("filum.barre.round_the_corner")],
            [["Shift", "Drag", "corner widget"], t("filum.barre.round_every_corner")],
            [[mod, "A"], t("filum.barre.every_point")],
          ];
    case "pen":
    case "satin": {
      const satin = s.tool === "satin";
      const width: Hint[] = satin ? [[["Wheel"], t("filum.barre.width")], [["[", "]"], t("filum.barre.width")]] : [];
      return s.drafting
        ? [
            [["LMB"], t("filum.barre.corner_point")],
            [["Drag"], t("filum.barre.curve_point")],
            [["Shift", "LMB"], satin ? "Angles in 15°" : "Angles in 45°"],
            [["Alt", "Drag"], t("filum.barre.break_the_handles")],
            [["Space", "Drag"], t("filum.barre.move_the_point")],
            [["Ctrl", "LMB"], t("filum.barre.no_snapping")],
            [["LMB", "first point"], t("filum.barre.close")],
            [["Alt", "LMB", "point"], t("filum.barre.delete_it")],
            ...width,
            [["Backspace"], t("filum.barre.remove_the_last_point")],
            [["Enter"], t("filum.barre.finish")],
          ]
        : [[["LMB"], t("filum.barre.start_with_a_corner")], [["Drag"], t("filum.barre.start_with_a_curve")], [["LMB", "path end"], t("filum.barre.continue_that_path")], ...width];
    }
    case "curve":
      return s.drafting
        ? [
            [["LMB"], t("filum.barre.smooth_point")],
            [["Double-click", "point"], t("filum.barre.corner_smooth")],
            [["Drag", "point"], t("filum.barre.move_it")],
            [["LMB", "first point"], t("filum.barre.close")],
            [["Alt", "LMB", "point"], t("filum.barre.delete_it")],
            [["Backspace"], t("filum.barre.remove_the_last_point")],
            [["Enter"], t("filum.barre.finish")],
          ]
        : [[["LMB"], t("filum.barre.start_the_path")], [["LMB", "path end"], t("filum.barre.continue_that_path")]];
    case "freehand":
      return [[["Drag"], t("filum.barre.draw")], [["Drag", "back to the start"], t("filum.barre.close")]];
    case "rect":
    case "ellipse":
      return [[["Drag"], t("filum.barre.draw")], [["Shift", "Drag"], t("filum.barre.square_regular")]];
    case "text":
      return [[["LMB"], t("filum.barre.place_lettering")], [["LMB", "lettering"], t("filum.barre.edit_it")]];
    case "cut":
      return [[["LMB", "line"], t("filum.barre.split_it")], [["Drag", "across a fill"], t("filum.barre.cut_it_in_two")]];
    case "gradient": {
      const m = s.toolOptions.gradient.mode ?? "colour";
      if (m !== "colour" || s.doc.objects.some((o) => s.selection.includes(o.id) && o.stitch.type === "fill" && o.stitch.ramp))
        return [
          [["Drag"], m === "blend" ? "Blend across the shape (this colour fades out)" : "Density across the shape (dense → open)"],
          [["Shift", "Drag"], t("filum.barre.in_45_steps")],
          [["Drag", "dot"], t("filum.barre.move_the_dense_end")],
          [["Drag", "ring"], t("filum.barre.move_the_open_end")],
          [["LMB"], t("filum.barre.select_a_shape")],
        ];
      return [[["Drag"], t("filum.barre.gradient_across_the_shape")], [["LMB", "line"], t("filum.barre.add_a_stop")], [["Alt", "LMB", "stop"], t("filum.barre.remove_it")], [["DblClick", "stop"], t("filum.barre.remove_it")]];
    }
    case "guides":
      return sel
        ? [
            [["Drag", "across"], t("filum.barre.add_a_direction_guide")],
            [["Drag", "end"], t("filum.barre.turn_it")],
            [["Drag", "guide"], t("filum.barre.move_it")],
            [["Alt", "LMB", "guide"], t("filum.barre.delete_it")],
            [["LMB", "other"], t("filum.barre.pick_another_satin")],
          ]
        : [[["LMB"], t("filum.barre.choose_a_satin_column")]];
    case "builder":
      return sel
        ? [
            [["LMB", "region"], t("filum.barre.make_it_its_own_shape")],
            [["Drag", "across regions"], t("filum.barre.merge_them")],
            [["Alt", "Drag"], t("filum.barre.delete_regions")],
            [["Shift", "LMB", "shape"], t("filum.barre.add_a_shape")],
            [["LMB", "empty"], t("filum.barre.deselect")],
          ]
        : [
            [["LMB"], t("filum.barre.choose_a_shape")],
            [["Shift", "LMB"], t("filum.barre.add_overlapping_shapes")],
          ];
    case "ruler":
      return [[["Drag"], t("filum.barre.measure")]];
    case "pan":
      return [[["Drag"], t("filum.barre.pan")]];
    default:
      return [];
  }
}

const NAV = (): Hint[] => [
  [["MMB"], t("filum.barre.pan")],
  [["Wheel"], t("filum.barre.zoom")],
  [["Space", "Drag"], t("filum.barre.pan")],
];

const MOUSE = new Set(["LMB", "RMB", "MMB", "Wheel", "Drag", "DblClick"]);
const MODS = ["Shift", "Ctrl", "Alt", "⌘"];

/** Mouse glyph: the pressed button filled. */
function Mouse({ b }: { b: string }) {
  const fill = "currentColor";
  return (
    <svg className="mouse" width="11" height="15" viewBox="0 0 11 15" aria-label={shown("tasto", b)}>
      <rect x="0.75" y="0.75" width="9.5" height="13.5" rx="4.75" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <line x1="5.5" y1="1" x2="5.5" y2="6" stroke="currentColor" strokeWidth="1" />
      {(b === "LMB" || b === "Drag" || b === "DblClick") && <path d="M5.5 1 A4.75 4.75 0 0 0 0.75 5.75 V6 H5.5 Z" fill={fill} />}
      {b === "RMB" && <path d="M5.5 1 A4.75 4.75 0 0 1 10.25 5.75 V6 H5.5 Z" fill={fill} />}
      {(b === "MMB" || b === "Wheel") && <rect x="4.5" y="2.4" width="2" height="3" rx="1" fill={fill} />}
    </svg>
  );
}

/**
 * NOVAstitch (modulo i): i tasti e le indicazioni («Drag», «corner») restano nomi interni nei dati;
 * qui si mostrano tradotti, se il catalogo ha filum.barre.<tasto|dove>.<nome>, altrimenti come sono.
 */
function shown(kind: "tasto" | "dove", k: string): string {
  const key = `filum.barre.${kind}.${k.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  const text = t(key);
  return text === key ? k : text;
}

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="sh-keys">
      {keys.map((k, i) =>
        MOUSE.has(k) ? (
          <span key={i} className="sh-mouse">
            <Mouse b={k} />
            {k === "Drag" ? <small>{t("filum.barre.drag")}</small> : k === "DblClick" ? <small>×2</small> : k === "Wheel" ? <small>{t("filum.barre.wheel")}</small> : null}
          </span>
        ) : /^[a-z]/.test(k) ? (
          <small key={i} className="sh-where">
            {shown("dove", k)}
          </small>
        ) : (
          <kbd key={i}>{shown("tasto", k)}</kbd>
        ),
      )}
    </span>
  );
}

export function StatusHints() {
  const s = useStore();
  const [held, setHeld] = useState<string | null>(null);
  useEffect(() => {
    const read = (e: KeyboardEvent) => setHeld(e.shiftKey ? "Shift" : e.ctrlKey ? "Ctrl" : e.altKey ? "Alt" : e.metaKey ? "⌘" : null);
    const clear = () => setHeld(null);
    window.addEventListener("keydown", read);
    window.addEventListener("keyup", read);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", read);
      window.removeEventListener("keyup", read);
      window.removeEventListener("blur", clear);
    };
  }, []);
  if (!s.prefs.hints) return null;
  let hints = hintsFor(s);
  // a held modifier: what it does here (when it does anything)
  const withMod = held ? hints.filter(([k]) => k.includes(held) || (held === "Ctrl" && k.includes(mod))) : [];
  if (withMod.length) hints = withMod;
  // nothing held: the plain hints and keyboard commands; mouse + modifier
  // variants appear while the modifier is held
  const variants = held ? [] : [...new Set(hints.filter(([k]) => k.some((x) => MOUSE.has(x)) && k.some((x) => MODS.includes(x))).map(([k]) => k.find((x) => MODS.includes(x))!))];
  if (!held) hints = hints.filter(([k]) => !(k.some((x) => MOUSE.has(x)) && k.some((x) => MODS.includes(x))));
  const nav = s.dialog || held ? [] : NAV();
  const n = s.selection.length;
  return (
    <div className="status-hints" aria-label={t("filum.barre.shortcuts")}>
      <div className="sh-list">
        {held && withMod.length > 0 && <span className="sh-held">{held}</span>}
        {hints.map(([k, label], i) => (
          <span key={i} className="sh">
            <Keys keys={k} />
            {label}
          </span>
        ))}
        {variants.length > 0 && (
          <span className="sh more">
            {t("filum.barre.hold")}
            {variants.map((v, i) => (
              <kbd key={i}>{v}</kbd>
            ))}
            {t("filum.barre.for_more")}
          </span>
        )}
        {nav.length > 0 && <span className="sh-sep" />}
        {nav.map(([k, label], i) => (
          <span key={`n${i}`} className="sh nav">
            <Keys keys={k} />
            {label}
          </span>
        ))}
      </div>
      <span className="sh-info">
        {n ? t("filum.barre.n_selected", { n }) : ""}
        {tn("filum.barre.n_objects", s.doc.objects.length)}
        {s.planning ? t("filum.barre.computing") : ""}
      </span>
    </div>
  );
}
