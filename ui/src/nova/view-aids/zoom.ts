// Module c, zoom: fit, 0.5×, 1×, 2×, 4×, 6× (Filum's 3× is gone). k× = k · pxPerMm,
// with the screen's calibration; without one 96/25.4 and the bar says so.

import { getLanguage, t } from "../core/i18n";
import { FILUM_PX_PER_MM } from "../core/bridge";
import { fit } from "../../lib/actions";
import { DEFAULT_PX_PER_MM, type ViewAids } from "./settings";
import "./texts";

export { DEFAULT_PX_PER_MM };

export type ZoomStep = "fit" | 0.5 | 1 | 2 | 4 | 6;
export const ZOOM_STEPS: readonly ZoomStep[] = ["fit", 0.5, 1, 2, 4, 6];

/** The canvas scale (CSS px per mm) of k×. */
export const screenScale = (k: number, pxPerMm: number): number => k * pxPerMm;

/** Filum's zoom (fit(k)) goes to k · 96/25.4: the factor to ask for k · pxPerMm. */
export const filumFactor = (k: number, pxPerMm: number): number => (k * pxPerMm) / FILUM_PX_PER_MM;

/** The button's text: «Adatta» / «Fit»; a factor is a number and the sign ×, with the language's decimal comma («0,5×» / «0.5×»). */
export function zoomLabel(step: ZoomStep): string {
  if (step === "fit") return t("c.zoom.fit");
  return `${getLanguage() === "it" ? String(step).replace(".", ",") : String(step)}×`;
}

export const zoomTitle = (step: ZoomStep): string => (step === "fit" ? t("c.zoom.fit.title") : t("c.zoom.k.title", { k: zoomLabel(step).replace("×", "") }));

/** The anchor of each button (anchors.json). */
export const zoomAnchor = (step: ZoomStep): string => (step === "fit" ? "c.zoomFit" : `c.zoom${String(step).replace(".", "")}`);

/** The step whose scale is the canvas's now (to light its button), or null. */
export function zoomStepAt(scale: number, pxPerMm: number): Exclude<ZoomStep, "fit"> | null {
  for (const s of ZOOM_STEPS) if (s !== "fit" && Math.abs(scale / screenScale(s, pxPerMm) - 1) < 0.01) return s;
  return null;
}

/** Zoom the canvas: fit the design, or k× around the centre of the window. */
export function zoomTo(step: ZoomStep, aids: Pick<ViewAids, "pxPerMm">): void {
  if (step === "fit") fit("design");
  else fit(filumFactor(step, aids.pxPerMm()));
}

/** What the bar says beside the zoom: «non calibrato» / «not calibrated», or nothing. */
export const zoomStatus = (aids: Pick<ViewAids, "calibrated">): string => (aids.calibrated() ? "" : t("c.zoom.uncalibrated"));
