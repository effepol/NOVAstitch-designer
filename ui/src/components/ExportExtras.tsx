// Export dialog building blocks: frame out on stops (Ink/Stitch stop
// position), repeats (Ink/Stitch ZIP "panelization"), picture options (PNG
// realistic / simple) with a live preview, and the file list of a ZIP.

import { FileArchive, Image as ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { engine } from "../engine/client";
import { isPicture, targetFileName, type PictureSettings } from "../lib/exportFiles";
import { defaultDesignOptions } from "../lib/geometry";
import { pictureSize, renderPicture } from "../lib/planImage";
import { useStore } from "../store";
import type { ExportOptions, PlanData } from "../types";
import { Num } from "./ui";
import "../output.css";
import { t, tn } from "../nova/i18n/filum";

/** Ink/Stitch "stop position": where the frame moves before every stop. */
export function StopPositionChoice({ stops }: { stops: number }) {
  const at = useStore((s) => s.doc.options?.stopPosition);
  const hoop = useStore((s) => s.doc.hoop);
  const commit = useStore((s) => s.commit);
  const set = (p: [number, number] | undefined) => commit((d) => ({ ...d, options: { ...(d.options ?? defaultDesignOptions()), stopPosition: p } }));
  return (
    <>
      <h4 title={t("filum.finestre.ink_stitch_stop_position_frame")}>
        {t("filum.finestre.frame_out_on_stops")}
      </h4>
      <div className="seg seg-full">
        <button className={!at ? "on" : ""} onClick={() => set(undefined)} title={t("filum.finestre.the_frame_stays_where_the")}>
          {t("filum.finestre.stay")}
        </button>
        <button
          className={at ? "on" : ""}
          onClick={() => set(at ?? [+(hoop.width / 2).toFixed(1), 0])}
          title={t("filum.finestre.the_needle_goes_to_this")}
        >
          {t("filum.finestre.move_to_point")}
        </button>
      </div>
      {at && (
        <div className="xp-origin">
          <label className="ctx-field">
            X <Num value={at[0]} unit="mm" step={1} onChange={(v) => set([v, at[1]])} />
          </label>
          <label className="ctx-field">
            Y <Num value={at[1]} unit="mm" step={1} onChange={(v) => set([at[0], v])} />
          </label>
        </div>
      )}
      {at && <p className="hint">{stops ? tn("filum.finestre.stops_needle_goes", stops, { x: at[0].toFixed(0), y: at[1].toFixed(0) }) : t("filum.finestre.the_design_has_no_stops")}</p>}
    </>
  );
}

/** Ink/Stitch ZIP "panelization": the design repeated in a grid. */
export function RepeatOptions({ opts, set, width, height }: { opts: ExportOptions; set: (o: ExportOptions) => void; width: number; height: number }) {
  const xr = opts.xRepeats ?? 1;
  const yr = opts.yRepeats ?? 1;
  const on = xr > 1 || yr > 1;
  return (
    <>
      <h4 title={t("filum.finestre.ink_stitch_panelization_the_design")}>{t("filum.finestre.repeats")}</h4>
      <div className="xp-repeat">
        <label className="ctx-field" title={t("filum.finestre.copies_side_by_side_ink")}>
          ↔ <Num value={xr} step={1} min={1} max={20} digits={0} onChange={(v) => set({ ...opts, xRepeats: Math.round(v) })} />
        </label>
        <label className="ctx-field" title={t("filum.finestre.distance_from_one_copy_to")}>
          <Num value={opts.xSpacing ?? 100} unit="mm" step={1} min={-1000} max={1000} onChange={(v) => set({ ...opts, xSpacing: v })} />
        </label>
        <label className="ctx-field" title={t("filum.finestre.copies_below_each_other_ink")}>
          ↕ <Num value={yr} step={1} min={1} max={20} digits={0} onChange={(v) => set({ ...opts, yRepeats: Math.round(v) })} />
        </label>
        <label className="ctx-field" title={t("filum.finestre.distance_from_one_copy_to_2")}>
          <Num value={opts.ySpacing ?? 100} unit="mm" step={1} min={-1000} max={1000} onChange={(v) => set({ ...opts, ySpacing: v })} />
        </label>
      </div>
      <p className="hint">
        {on ? (
          <>
            {xr * yr}{t("filum.finestre.copies_each_colour_sews_all")}
            {(Math.abs(opts.xSpacing ?? 100) < width && xr > 1) || (Math.abs(opts.ySpacing ?? 100) < height && yr > 1) ? t("filum.finestre.the_copies_overlap_spacing_below") : ""}
            {" · "}
            <button className="link" onClick={() => set({ ...opts, xRepeats: 1, yRepeats: 1 })}>
              {t("filum.finestre.reset")}
            </button>
          </>
        ) : (
          t("filum.finestre.n1_1_the_design_once")
        )}
      </p>
    </>
  );
}

/** PNG options (Ink/Stitch: DPI, simple line width) and the background. */
export function PictureOptionsPanel({ kinds, pics, set }: { kinds: string[]; pics: PictureSettings; set: (p: PictureSettings) => void }) {
  const realistic = kinds.includes("png_realistic");
  const simple = kinds.includes("png_simple");
  const dpis: [number, string][] = [
    [150, "150"],
    [300, "300"],
    [600, "600"],
  ];
  const dpiRow = (value: number, put: (v: number) => void, label: string) => (
    <label className="xp-dpi" title={t("filum.finestre.pixels_per_inch_300_prints")}>
      <span>{label}</span>
      <div className="seg">
        {dpis.map(([v, l]) => (
          <button key={v} className={value === v ? "on" : ""} onClick={() => put(v)}>
            {l}
          </button>
        ))}
      </div>
      <Num value={value} unit={t("filum.finestre.dpi")} step={50} min={100} max={2000} digits={0} onChange={put} />
    </label>
  );
  return (
    <>
      <h4>{t("filum.finestre.picture")}</h4>
      {realistic && dpiRow(pics.dpiRealistic, (v) => set({ ...pics, dpiRealistic: v }), simple ? "Realistic" : "Resolution")}
      {simple && dpiRow(pics.dpiSimple, (v) => set({ ...pics, dpiSimple: v }), realistic ? "Simple" : "Resolution")}
      {simple && (
        <label className="xp-dpi" title={t("filum.finestre.width_of_the_stitch_lines")}>
          <span>{t("filum.finestre.line_width")}</span>
          <Num value={pics.lineWidth} unit="mm" step={0.05} min={0.01} max={5} onChange={(v) => set({ ...pics, lineWidth: v })} />
        </label>
      )}
      <div className="seg seg-full" title={t("filum.finestre.behind_the_stitches")}>
        {(
          [
            ["transparent", t("filum.finestre.transparent"), t("filum.finestre.no_background_place_it_on")],
            ["white", t("filum.finestre.white"), "A white background"],
            ["fabric", t("filum.finestre.fabric"), t("filum.finestre.the_fabric_colour_of_the")],
          ] as const
        ).map(([v, l, t]) => (
          <button key={v} className={pics.background === v ? "on" : ""} title={t} onClick={() => set({ ...pics, background: v })}>
            {l}
          </button>
        ))}
      </div>
    </>
  );
}

/** A live preview of the picture and its size in pixels. */
export function PicturePreview({ kind, pics, opts }: { kind: string; pics: PictureSettings; opts: ExportOptions }) {
  const doc = useStore((s) => s.doc);
  const fabricColor = useStore((s) => s.fabricColor);
  const ref = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      engine
        .exportPlan(doc, opts)
        .then((p) => live && setPlan(p))
        .catch(() => live && setPlan(null));
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [doc, opts]);
  const realistic = kind === "png_realistic";
  const dpi = realistic ? pics.dpiRealistic : pics.dpiSimple;
  const size = plan ? pictureSize(plan, { dpi }) : null;
  useEffect(() => {
    const box = ref.current;
    if (!box || !plan || !size) return;
    // the preview at about the box size, line width to scale
    const f = Math.min(1, 560 / Math.max(size.w, size.h));
    const c = renderPicture(plan, {
      kind: realistic ? "realistic" : "simple",
      dpi: dpi * f,
      lineWidth: pics.lineWidth,
      background: pics.background,
      fabricColor,
      threadWeight: doc.options?.threadWeight,
    });
    c.className = "xp-pic-canvas";
    box.replaceChildren(c);
  }, [plan, kind, dpi, pics.lineWidth, pics.background, fabricColor, doc.options?.threadWeight, realistic, size?.w, size?.h]);
  return (
    <div className="xp-pic">
      <div className={`xp-pic-box ${pics.background === "transparent" ? "checker" : ""}`} ref={ref} />
      <p className="hint">
        <ImageIcon size={12} /> {size ? t("filum.finestre.v1_v2_px_at_dpi", { v1: size.w.toLocaleString(), v2: size.h.toLocaleString(), dpi }) : t("filum.finestre.nothing_to_show_yet")}
        {size && Math.max(size.w, size.h) > 16000 && t("filum.finestre.scaled_down_to_16_000")}
      </p>
    </div>
  );
}

/** What the ZIP will hold. */
export function ZipFileList({ targets, name, onRemove }: { targets: string[]; name: string; onRemove: (t: string) => void }) {
  return (
    <div className="xp-zip">
      <div className="exp-colours-head">
        <b>
          <FileArchive size={14} /> {name}{t("filum.finestre.zip")}
        </b>
        <span className="stat">{targets.length ? tn("filum.finestre.n_files_pick_formats", targets.length) : t("filum.finestre.pick_the_files_to_include")}</span>
      </div>
      <div className="xp-zip-list">
        {targets.map((th) => (
          <div key={th} className="xp-zip-file">
            <span>{targetFileName(th, name, true)}</span>
            <span className="stat">{isPicture(th) ? t("filum.finestre.picture_2") : th === "threadlist" ? t("filum.finestre.thread_list") : th === "svg" ? t("filum.finestre.ink_stitch_svg") : th === "filum" ? t("filum.finestre.project") : t("filum.finestre.stitch_file")}</span>
            <button className="mini" title={t("filum.finestre.leave_out")} onClick={() => onRemove(th)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
