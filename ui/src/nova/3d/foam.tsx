// Module j: satin over 3D foam (contract, module j). Not a stitch type of its
// own (Architect, 24/11): a satin with the foam block (SatinParams.foam;
// absent = a normal satin). Its section «Schiuma 3D» goes into Filum's satin
// section through module 0's hook (registerStitchFields, #58). The stitches
// come from the core (crates/core/src/stitches/foam.rs): contour, caps, denser
// satin, a machine stop before it. The note for the work sheet (module l) is
// t("j.foam.sheetNote").

import type { FoamOptions, SatinParams, StitchParams } from "../../types";
import { Num, Row, Toggle } from "../../components/ui";
import { registerStitchFields, type StitchSectionProps } from "../core/stitchTypes";
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
