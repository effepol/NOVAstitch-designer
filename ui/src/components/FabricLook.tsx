// How the fabric looks on the canvas (a view setting, not part of the
// design): its colour, its texture — the design's fabric or another weave —
// whether the weave stays visible when zoomed out, and whether the vector and
// stitch views show it too. Used by the Scene panel and Preferences.

import { t } from "../nova/i18n/filum";
import { fabricInfo } from "../lib/materials";
import { useStore } from "../store";
import type { Fabric } from "../types";
import { Row, Toggle } from "./ui";

/** Fabric colours to pick at a glance. */
const SWATCHES = (): [string, string][] => [
  ["#f4f1ea", t("filum.pannelli.natural")],
  ["#ffffff", t("filum.pannelli.white")],
  ["#d6d4cf", t("filum.pannelli.light_grey")],
  ["#5b5f66", t("filum.pannelli.charcoal")],
  ["#1d1d1f", t("filum.pannelli.black")],
  ["#1f2a44", t("filum.pannelli.navy")],
  ["#7a1f27", t("filum.pannelli.burgundy")],
  ["#2f4a35", t("filum.pannelli.forest")],
];

/** Textures (the realistic view's weaves, by the fabric that has them). */
const TEXTURES = (): [Fabric | "none", string][] => [
  ["cotton", t("filum.pannelli.plain_weave")],
  ["silk", t("filum.pannelli.fine_weave")],
  ["canvas", t("filum.pannelli.canvas")],
  ["sheer", t("filum.pannelli.organza")],
  ["denim", t("filum.pannelli.twill")],
  ["knit", t("filum.pannelli.jersey")],
  ["pique", t("filum.pannelli.pique")],
  ["fleece", t("filum.pannelli.fleece")],
  ["felt", t("filum.pannelli.felt")],
  ["towel", t("filum.pannelli.terry")],
  ["leather", t("filum.pannelli.leather")],
  ["none", t("filum.pannelli.none_plain_colour")],
];

export function FabricLookRows() {
  const color = useStore((s) => s.fabricColor);
  const texture = useStore((s) => s.fabricTexture);
  const all = useStore((s) => s.fabricAll);
  const weave = useStore((s) => s.fabricWeave);
  const fabric = useStore((s) => s.doc.fabric);
  const set = useStore((s) => s.set);
  return (
    <>
      <Row label={t("filum.pannelli.fabric_colour")} title={t("filum.pannelli.the_fabric_on_the_canvas")}>
        <span className="fl-swatches">
          {SWATCHES().map(([hex, name]) => (
            <button
              key={hex}
              className={`fl-swatch ${color.toLowerCase() === hex ? "on" : ""}`}
              style={{ background: hex }}
              title={name}
              aria-label={name}
              onClick={() => set({ fabricColor: hex })}
            />
          ))}
          <input type="color" className="fl-custom" value={color} onChange={(e) => set({ fabricColor: e.target.value })} title={t("filum.pannelli.any_colour")} aria-label={t("filum.pannelli.custom_fabric_colour")} />
        </span>
      </Row>
      <Row label={t("filum.pannelli.texture")} title={t("filum.pannelli.the_weave_in_the_realistic")}>
        <select className="select" style={{ width: "100%" }} value={texture} onChange={(e) => set({ fabricTexture: e.target.value as typeof texture })}>
          <option value="auto">{t("filum.pannelli.auto_label", { label: fabricInfo(fabric).label })}</option>
          {TEXTURES().map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </Row>
      <Row label={t("filum.pannelli.visible_weave")} title={t("filum.pannelli.draw_the_weave_coarse_enough")}>
        <Toggle on={weave} onChange={(v) => set({ fabricWeave: v })} />
      </Row>
      <Row label={t("filum.pannelli.in_every_view")} title={t("filum.pannelli.show_the_fabric_colour_in")}>
        <Toggle on={all} onChange={(v) => set({ fabricAll: v })} />
      </Row>
    </>
  );
}
