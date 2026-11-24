// Module j: layered 3D (contract, module j; Signor Poletti, 24/11), a stitch
// type of its own ("layered3d", only in .nsd files) registered with module 0's
// hook (#58): its card in Filum's stitch picker beside the satin, and its
// section in the properties panel. From a satin column the core
// (crates/core/src/stitches/layered3d.rs) makes 2 to 4 growing inner layers —
// a core over two underlay layers and a contour, then wider layers — and the
// final layer, the column itself; edges staggered by 0.3 mm. The inner layers
// are sewn with the thread the operator chooses (baseThread); a metallic only
// on the final layer.

import type { DesignObject, Layered3dParams, SatinParams, StitchParams, Thread } from "../../types";
import { defaultSatin } from "../../lib/geometry";
import { useStore } from "../../store";
import { Num, Row, Slider } from "../../components/ui";
import { registerStitchType, type StitchSectionProps } from "../core/stitchTypes";
import { t } from "../core/i18n";
import "./texts";

/** Inner layers: 2 by default, 4 at most (Signor Poletti, 24/11; 5 is refused, j.12). */
export const LAYERED3D_MIN_LAYERS = 2;
export const LAYERED3D_MAX_LAYERS = 4;
/** Each inner layer this much narrower than the next (both sides): 0.3 mm a side. PROVISIONAL, to tune at the first stitch-out. */
export const LAYERED3D_SHRINK = 0.6;

/** Whether a number of layers is taken (2 to 4). */
export const acceptsLayers = (n: number): boolean => Number.isInteger(n) && n >= LAYERED3D_MIN_LAYERS && n <= LAYERED3D_MAX_LAYERS;

export const isLayered3d = (st: StitchParams): st is { type: "layered3d" } & Layered3dParams => st.type === "layered3d";

/** The object's stitch as layered 3D: a satin keeps its own values (without the foam block), anything else starts from the satin defaults. */
export function toLayered3d(o: DesignObject): StitchParams {
  if (isLayered3d(o.stitch)) return o.stitch;
  const satin: SatinParams = o.stitch.type === "satin" ? (({ type: _t, foam: _f, ...s }) => s)(o.stitch) : defaultSatin();
  // Filum's zig-zag underlay spacing
  return { ...satin, type: "layered3d", layers: LAYERED3D_MIN_LAYERS, underlayZigzagSpacing: defaultSatin().zigzagUnderlaySpacing, shrinkPerLayer: LAYERED3D_SHRINK };
}

const icon = (
  <svg viewBox="0 0 40 24" width="40" height="24" aria-hidden="true">
    <rect x="11" y="13" width="18" height="4" rx="2" fill="currentColor" opacity="0.5" />
    <rect x="8" y="10" width="24" height="8" rx="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <rect x="5" y="7" width="30" height="12" rx="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

export function Layered3dSection({ o, up, threads }: StitchSectionProps & { threads?: Thread[] }) {
  const docThreads = useStore((s) => s.doc.threads);
  const list = threads ?? docThreads;
  const st = o.stitch as { type: "layered3d" } & Layered3dParams;
  const centreLine = o.paths.filter((p) => p.nodes.length >= 2).length === 1;
  return (
    <div data-nova-anchor="j.layered3d.section">
      <p className="hint">{t("j.layered3d.hint")}</p>
      {centreLine && (
        <Row label={t("j.layered3d.width")}>
          <Slider min={1} max={15} step={0.1} value={st.width} unit="mm" onChange={(v) => up({ width: v })} />
        </Row>
      )}
      <Row label={t("j.layered3d.spacing")}>
        <Slider min={0.2} max={1.5} step={0.05} value={st.spacing} unit="mm" onChange={(v) => up({ spacing: v })} />
      </Row>
      <Row label={t("j.layered3d.layers")} title={t("j.layered3d.layers.title")}>
        <span data-nova-anchor="j.layered3d.layers">
          <Num value={st.layers} step={1} digits={0} min={LAYERED3D_MIN_LAYERS} max={LAYERED3D_MAX_LAYERS} onChange={(v) => acceptsLayers(v) && up({ layers: v })} />
        </span>
      </Row>
      <Row label={t("j.layered3d.underlayZigzagSpacing")} title={t("j.layered3d.underlayZigzagSpacing.title")}>
        <Num value={st.underlayZigzagSpacing} step={0.1} digits={1} min={0.5} max={8} unit="mm" onChange={(v) => up({ underlayZigzagSpacing: v })} />
      </Row>
      <Row label={t("j.layered3d.shrinkPerLayer")} title={t("j.layered3d.shrinkPerLayer.title")}>
        <Num value={st.shrinkPerLayer} step={0.1} digits={2} min={0.6} max={3} unit="mm" onChange={(v) => up({ shrinkPerLayer: v })} />
      </Row>
      <Row label={t("j.layered3d.baseThread")} title={t("j.layered3d.baseThread.title")}>
        <select className="select" style={{ width: "100%" }} data-nova-anchor="j.layered3d.baseThread" value={st.baseThread ?? ""} onChange={(e) => up({ baseThread: e.target.value || undefined })}>
          <option value="">{t("j.layered3d.baseThread.same")}</option>
          {list
            .filter((th) => th.id !== o.thread)
            .map((th) => (
              <option key={th.id} value={th.id}>
                {[th.name, th.brand, th.code].filter(Boolean).join(" · ")}
              </option>
            ))}
        </select>
      </Row>
    </div>
  );
}

export const registerLayered3d = (): (() => void) =>
  registerStitchType({
    id: "j.layered3d",
    module: "j",
    group: "line",
    label: () => t("j.layered3d.name"),
    title: () => t("j.layered3d.title"),
    icon,
    matches: isLayered3d,
    apply: toLayered3d,
    Section: Layered3dSection,
  });
