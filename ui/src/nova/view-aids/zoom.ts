// Module c, zoom: the bar's buttons are fit, 0.5×, 1×, 2×, 4×, 6× (module 0's hook
// in BottomBar.tsx; Filum's 3× is gone). k× = k · pxPerMm: module c registers the
// screen's calibration as the 1× scale (registerScreenScale); without one the
// canvas uses 96/25.4 and the bar says «non calibrato».

import { t } from "../core/i18n";
import { DEFAULT_PX_PER_MM, type ViewAids } from "./settings";
import "./texts";

export { DEFAULT_PX_PER_MM };

export type ZoomStep = "fit" | 0.5 | 1 | 2 | 4 | 6;
export const ZOOM_STEPS: readonly ZoomStep[] = ["fit", 0.5, 1, 2, 4, 6];

/** The canvas scale (CSS px per mm) of k×. */
export const screenScale = (k: number, pxPerMm: number): number => k * pxPerMm;

/** The 1× scale module c hands the canvas: the calibration, or null (then 96/25.4). */
export const calibratedScale = (aids: Pick<ViewAids, "calibrated" | "pxPerMm">): number | null => (aids.calibrated() ? aids.pxPerMm() : null);

/** What the bar says while the screen is not calibrated: «non calibrato» / «not calibrated», or nothing. */
export const zoomStatus = (aids: Pick<ViewAids, "calibrated">): string => (aids.calibrated() ? "" : t("c.zoom.uncalibrated"));
