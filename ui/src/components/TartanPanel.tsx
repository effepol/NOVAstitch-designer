// The Tartan section of a tartan fill: the stripes of its sett (colour,
// width, sewn or left out), a live swatch, and how the pattern lies and is
// sewn. Every change keeps the colour layers in step (lib/tartan).

import { t, tn } from "../nova/i18n/filum";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { parsePalette, paletteCode, paletteProblem, patchTartan, swatchCss, syncTartan, tartanColors, tartanMirrored, type TartanStripe } from "../lib/tartan";
import { useStore } from "../store";
import type { TartanParams } from "../types";
import { Num, Row, Section, Slider, Toggle } from "./ui";

export function TartanSection({ t: th }: { t: TartanParams }) {
  const set = (patch: Partial<TartanParams>) => {
    const s = useStore.getState();
    // a code with nothing to sew would remove every layer: refused
    const problem = patch.palette !== undefined ? paletteProblem(patch.palette) : null;
    if (problem) return s.toast(problem, "error");
    const { layer: _l, group, ...rest } = patchTartan(th, patch);
    void _l;
    s.commit((d) => syncTartan(d, group, rest));
  };
  const { warp, weft, equal } = parsePalette(th.palette);
  // what the engine mirrors (old tartans may have the flag without "/" pivots)
  const symmetric = tartanMirrored(th);
  const [side, setSide] = useState<"warp" | "weft">("warp");
  const stripes = side === "weft" && !equal ? weft : warp;
  const setStripes = (next: TartanStripe[], sym = symmetric) =>
    set({ palette: equal ? paletteCode(next, sym) : side === "warp" ? paletteCode(next, sym, weft) : paletteCode(warp, sym, next) });
  const colours = tartanColors(th.palette);
  return (
    <Section title={t("filum.pannelli.tartan")}>
      <div className="tartan-swatch" style={{ background: swatchCss(th.palette, 3, symmetric),height: 46, borderRadius: 6, border: "1px solid var(--border)", marginBottom: 8, transform: `rotate(${th.rotate}deg)` }} title={t("filum.pannelli.the_sett_warp_stripes_across")} />
      <p className="hint" style={{ margin: "0 0 6px" }}>
        {tn("filum.pannelli.n_thread_colours_each_layer", colours.length)}
      </p>
      {!equal && (
        <div className="seg" style={{ marginBottom: 6 }}>
          <button className={side === "warp" ? "on" : ""} onClick={() => setSide("warp")}>
            {t("filum.pannelli.warp")}
          </button>
          <button className={side === "weft" ? "on" : ""} onClick={() => setSide("weft")}>
            {t("filum.pannelli.weft")}
          </button>
        </div>
      )}
      <div className="tartan-stripes">
        {stripes.map((s, i) => (
          <div key={i} className="dz-inline" style={{ marginBottom: 4 }}>
            <input type="color" value={s.color} title={t("filum.pannelli.stripe_colour")} onChange={(e) => setStripes(stripes.map((x, k) => (k === i ? { ...x, color: e.target.value } : x)))} />
            <Num value={s.width} step={0.1} min={0.1} max={50} unit="mm" onChange={(v) => setStripes(stripes.map((x, k) => (k === i ? { ...x, width: v } : x)))} />
            <select className="select" value={s.render} title={t("filum.pannelli.sewn_left_out_the_fabric")} onChange={(e) => setStripes(stripes.map((x, k) => (k === i ? { ...x, render: Number(e.target.value) as 0 | 1 | 2 } : x)))}>
              <option value={1}>{t("filum.pannelli.sewn")}</option>
              <option value={0}>{t("filum.pannelli.left_out")}</option>
              <option value={2}>{t("filum.pannelli.as_before")}</option>
            </select>
            <button className="icon-btn" title={t("filum.pannelli.remove_the_stripe")} disabled={stripes.length <= 1} onClick={() => setStripes(stripes.filter((_, k) => k !== i))}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <button className="btn sm ghost" onClick={() => setStripes([...stripes, { color: stripes[stripes.length - 1]?.color ?? "#000000", width: 2, render: 1 }])}>
          <Plus size={12} />{t("filum.pannelli.stripe")}
        </button>
      </div>
      <Row label={t("filum.pannelli.mirrored")} title={t("filum.pannelli.a_symmetric_sett_the_stripes")}>
        <Toggle on={symmetric} onChange={(v) => set({ palette: equal ? paletteCode(warp, v) : paletteCode(warp, v, weft), symmetry: v })} />
      </Row>
      <Row label={t("filum.pannelli.warp_weft")} title={t("filum.pannelli.different_stripes_across_and_down")}>
        <Toggle on={!equal} onChange={(v) => set({ palette: v ? paletteCode(warp, symmetric, warp) : paletteCode(warp, symmetric) })} />
      </Row>
      <Row label={t("filum.pannelli.size")} title={t("filum.pannelli.scale_of_the_whole_pattern")}>
        <Slider min={25} max={400} step={5} digits={0} unit="%" value={th.scale} onChange={(v) => set({ scale: v })} />
      </Row>
      <Row label={t("filum.pannelli.turn")} title={t("filum.pannelli.rotation_of_the_pattern")}>
        <Slider min={-90} max={90} step={1} digits={0} unit="°" value={th.rotate} onChange={(v) => set({ rotate: v })} />
      </Row>
      <Section title={t("filum.pannelli.weave")} defaultOpen={false}>
        <Row label={t("filum.pannelli.twill_angle")} title={t("filum.pannelli.angle_of_the_rows_to")}>
          <Slider min={-90} max={90} step={5} digits={0} unit="°" value={th.angle} onChange={(v) => set({ angle: v })} />
        </Row>
        <Row label={t("filum.pannelli.rows_thread")} title={t("filum.pannelli.rows_of_one_direction_before")}>
          <Num value={th.rowsPerThread} step={1} min={1} max={8} digits={0} onChange={(v) => set({ rowsPerThread: Math.round(v) })} />
        </Row>
        <Row label={t("filum.pannelli.herringbone")} title={t("filum.pannelli.the_twill_turns_every_this")}>
          <Num value={th.herringbone} step={0.5} min={0} max={30} unit="mm" onChange={(v) => set({ herringbone: v })} />
        </Row>
        <Row label={t("filum.pannelli.lines_below")} title={t("filum.pannelli.stripes_this_narrow_or_narrower")}>
          <Num value={th.minStripeWidth} step={0.1} min={0} max={5} unit="mm" onChange={(v) => set({ minStripeWidth: v })} />
        </Row>
        <Row label={t("filum.pannelli.offset")} title={t("filum.pannelli.shift_the_stripes_across_and")}>
          <span className="dz-inline">
            <Num value={th.offset[0]} step={0.5} unit={t("filum.pannelli.x")} onChange={(v) => set({ offset: [v, th.offset[1]] })} />
            <Num value={th.offset[1]} step={0.5} unit={t("filum.pannelli.y")} onChange={(v) => set({ offset: [th.offset[0], v] })} />
          </span>
        </Row>
        <Row label={t("filum.pannelli.code")} title={t("filum.pannelli.ink_stitch_palette_code_paste")}>
          <input className="input" style={{ width: "100%", fontSize: "var(--fs-xs)" }} defaultValue={th.palette} key={th.palette} onBlur={(e) => e.target.value.trim() && e.target.value !== th.palette && set({ palette: e.target.value.trim() })} />
        </Row>
      </Section>
    </Section>
  );
}
