// Module j: satin over 3D foam (contract, module j), a stitch type of its own
// ("foam", only in .nsd files) registered with module 0's hook (#58): its card
// in Filum's stitch picker beside the satin, and its section in the properties
// panel. The stitches come from the core (crates/core/src/stitches/foam.rs):
// contour, caps, denser satin, a machine stop before it. The note for the work
// sheet (module l) is t("j.foam.sheetNote").

import type { DesignObject, FoamParams, SatinParams, StitchParams } from "../../types";
import { defaultSatin } from "../../lib/geometry";
import { Num, Row, Slider, Toggle } from "../../components/ui";
import { registerStitchType, type StitchSectionProps } from "../core/stitchTypes";
import { t } from "../core/i18n";
import "./texts";

/** Contour passes over foam: 1 by default, 2 at most (contract j.2: 3 is refused). */
export const FOAM_MAX_CONTOUR_PASSES = 2;
/** "40–50 % heavier" (Punch), read as density. PROVISIONAL, to check at the first stitch-out: 0.40 → 0.28 mm. */
export const FOAM_DENSITY_FACTOR = 1.45;

/** Whether a number of contour passes is taken (1 or 2). */
export const acceptsContourPasses = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= FOAM_MAX_CONTOUR_PASSES;

export const isFoam = (st: StitchParams): st is { type: "foam" } & FoamParams => st.type === "foam";

/** The object's stitch as foam: a satin keeps its own values, anything else starts from the satin defaults. */
export function toFoam(o: DesignObject): StitchParams {
  if (isFoam(o.stitch)) return o.stitch;
  const satin: SatinParams = o.stitch.type === "satin" ? (({ type: _t, ...s }) => s)(o.stitch) : defaultSatin();
  return { ...satin, type: "foam", contourPasses: 1, densityFactor: FOAM_DENSITY_FACTOR, caps: true };
}

const icon = (
  <svg viewBox="0 0 40 24" width="40" height="24" aria-hidden="true">
    <rect x="5" y="9" width="30" height="8" rx="2" fill="currentColor" opacity="0.25" />
    <path d="M6 15 L9 6 M10 15 L13 6 M14 15 L17 6 M18 15 L21 6 M22 15 L25 6 M26 15 L29 6 M30 15 L33 6" stroke="currentColor" strokeWidth="1.4" fill="none" />
  </svg>
);

export function FoamSection({ o, up }: StitchSectionProps) {
  const st = o.stitch as { type: "foam" } & FoamParams;
  const centreLine = o.paths.filter((p) => p.nodes.length >= 2).length === 1;
  return (
    <div data-nova-anchor="j.foam.section">
      <p className="hint">{t("j.foam.hint")}</p>
      {centreLine && (
        <Row label={t("j.foam.width")}>
          <Slider min={1} max={12} step={0.1} value={st.width} unit="mm" onChange={(v) => up({ width: v })} />
        </Row>
      )}
      <Row label={t("j.foam.spacing")} title={t("j.foam.spacing.title", { mm: +(st.spacing / (st.densityFactor || FOAM_DENSITY_FACTOR)).toFixed(2) })}>
        <Slider min={0.2} max={1.5} step={0.05} value={st.spacing} unit="mm" onChange={(v) => up({ spacing: v })} />
      </Row>
      <Row label={t("j.foam.contourPasses")} title={t("j.foam.contourPasses.title")}>
        <span data-nova-anchor="j.foam.contourPasses">
          <Num value={st.contourPasses} step={1} digits={0} min={1} max={FOAM_MAX_CONTOUR_PASSES} onChange={(v) => acceptsContourPasses(v) && up({ contourPasses: v })} />
        </span>
      </Row>
      <Row label={t("j.foam.densityFactor")} title={t("j.foam.densityFactor.title")}>
        <Num value={st.densityFactor} step={0.05} digits={2} min={1} max={2} onChange={(v) => up({ densityFactor: v })} />
      </Row>
      <Row label={t("j.foam.caps")} title={t("j.foam.caps.title")}>
        <span data-nova-anchor="j.foam.caps">
          <Toggle on={st.caps} onChange={(v) => up({ caps: v })} title={t("j.foam.caps.title")} />
        </span>
      </Row>
    </div>
  );
}

export const registerFoam = (): (() => void) =>
  registerStitchType({
    id: "j.foam",
    module: "j",
    group: "line",
    label: () => t("j.foam.name"),
    title: () => t("j.foam.title"),
    icon,
    matches: isFoam,
    apply: toFoam,
    Section: FoamSection,
  });
