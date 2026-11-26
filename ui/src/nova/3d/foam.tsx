// Module j: satin over 3D foam (contract, module j). Not a stitch type of its
// own (Architect, 24/11): a satin with the foam block (SatinParams.foam;
// absent = a normal satin). Its section «Schiuma 3D» goes into Filum's satin
// section through module 0's hook (registerStitchFields, #58). The stitches
// come from the core (crates/core/src/stitches/foam.rs): contour, caps, denser
// satin, a machine stop before it. The note for the work sheet (module l) is
// t("j.foam.sheetNote").

import type { DesignObject, FoamOptions, SatinParams, StitchParams } from "../../types";
import { defaultSatin } from "../../lib/geometry";
import { Num, Row, Toggle } from "../../components/ui";
import { registerStitchFields, registerStitchType, type StitchSectionProps } from "../core/stitchTypes";
import { t } from "../core/i18n";
import "./texts";

/** Contour passes over foam: 1 by default, 2 at most (contract j.2: 3 is refused). */
export const FOAM_MAX_CONTOUR_PASSES = 2;
/** "40–50 % heavier" (Punch), read as density. PROVISIONAL, to check at the first stitch-out: 0.40 → 0.28 mm. */
export const FOAM_DENSITY_FACTOR = 1.45;

/** Whether a number of contour passes is taken (1 or 2). */
export const acceptsContourPasses = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= FOAM_MAX_CONTOUR_PASSES;

/** The foam block's defaults: 1 contour pass, density × 1.45, caps on. */
export const defaultFoam = (): FoamOptions => ({ contourPasses: 1, densityFactor: FOAM_DENSITY_FACTOR, caps: true });

/** A satin sewn over foam (a satin with its foam block). */
export const isFoam = (st: StitchParams): st is { type: "satin" } & SatinParams & { foam: FoamOptions } => st.type === "satin" && !!st.foam;

export function FoamFields({ o, up }: StitchSectionProps) {
  if (o.stitch.type !== "satin") return null;
  const st = o.stitch;
  const foam = st.foam;
  const set = (p: Partial<FoamOptions>) => up({ foam: { ...(foam ?? defaultFoam()), ...p } });
  return (
    <div data-nova-anchor="j.foam.section">
      <Row label={t("j.foam.name")} title={t("j.foam.title")}>
        <span data-nova-anchor="j.foam.on">
          <Toggle on={!!foam} onChange={(v) => up({ foam: v ? defaultFoam() : undefined })} title={t("j.foam.title")} />
        </span>
      </Row>
      {foam && (
        <>
          <p className="hint">{t("j.foam.hint", { mm: +(st.spacing / (foam.densityFactor || FOAM_DENSITY_FACTOR)).toFixed(2) })}</p>
          <Row label={t("j.foam.contourPasses")} title={t("j.foam.contourPasses.title")}>
            <span data-nova-anchor="j.foam.contourPasses">
              <Num value={foam.contourPasses} step={1} digits={0} min={1} max={FOAM_MAX_CONTOUR_PASSES} onChange={(v) => acceptsContourPasses(v) && set({ contourPasses: v })} />
            </span>
          </Row>
          <Row label={t("j.foam.densityFactor")} title={t("j.foam.densityFactor.title")}>
            <Num value={foam.densityFactor} step={0.05} digits={2} min={1} max={2} onChange={(v) => set({ densityFactor: v })} />
          </Row>
          <Row label={t("j.foam.caps")} title={t("j.foam.caps.title")}>
            <span data-nova-anchor="j.foam.caps">
              <Toggle on={foam.caps} onChange={(v) => set({ caps: v })} title={t("j.foam.caps.title")} />
            </span>
          </Row>
        </>
      )}
    </div>
  );
}

export const registerFoam = (): (() => void) => registerStitchFields({ id: "j.foam", module: "j", type: "satin", Fields: FoamFields });

/** The object as a satin over foam: made a satin as Filum's Satin card does (a satin keeps its own values, rails and all;
 *  anything else starts from the satin defaults; the paths stay), with the foam block on (its own values if it has one). */
export function toFoamSatin(o: DesignObject): StitchParams {
  const own: Partial<SatinParams> = o.stitch.type === "satin" ? (({ type: _t, ...rest }) => rest)(o.stitch) : {};
  return { type: "satin", ...defaultSatin(), ...own, method: "satin", foam: own.foam ?? defaultFoam() };
}

const foamIcon = (
  <svg viewBox="0 0 40 24" width="40" height="24" aria-hidden="true">
    <path d="M6 18 Q20 4 34 18" fill="currentColor" opacity="0.25" />
    <path d="M8 18 L11 10 M13 18 L16 7 M18 18 L21 6 M23 18 L26 7 M28 18 L31 10" stroke="currentColor" strokeWidth="1.4" fill="none" />
    <line x1="4" y1="19" x2="36" y2="19" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

/** The «Schiuma 3D» card in Filum's stitch picker, with the lines beside Satin (Architect, 26/11). It is
 *  never the object's own type (matches: false): a type the object has replaces Filum's satin section in
 *  the panel (module 0's hook), and a satin over foam keeps it — settings and the switch that takes the
 *  foam off. It shows chosen once module 0's hook can keep Filum's section. */
export const registerFoamButton = (): (() => void) =>
  registerStitchType({
    id: "j.foam3d",
    module: "j",
    group: "line",
    label: () => t("j.foam3d.name"),
    title: () => t("j.foam3d.title"),
    icon: foamIcon,
    matches: () => false,
    apply: toFoamSatin,
    // never shown (matches is false): the foam's fields are in Filum's satin section
    Section: () => null,
  });
