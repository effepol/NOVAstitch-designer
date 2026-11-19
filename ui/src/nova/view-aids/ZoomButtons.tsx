// Module c, the zoom buttons of the bottom bar: fit, 0.5×, 1×, 2×, 4×, 6×, and
// «non calibrato» while the screen is not calibrated. Module 0's hook in
// BottomBar.tsx puts this in place of Filum's buttons (request of 18/11).

import { useSyncExternalStore } from "react";
import { useStore } from "../../store";
import { useLanguage } from "../core/i18n";
import { t } from "../core/i18n";
import { viewAids } from "./install";
import { ZOOM_STEPS, zoomAnchor, zoomLabel, zoomStatus, zoomStepAt, zoomTitle, zoomTo } from "./zoom";
import "./texts";

let version = 0;
const subscribe = (fn: () => void) => viewAids()?.onChange(() => (version++, fn())) ?? (() => {});

export function ZoomButtons() {
  useLanguage();
  useSyncExternalStore(subscribe, () => version);
  const scale = useStore((s) => s.view.scale);
  const aids = viewAids();
  if (!aids) return null;
  const lit = zoomStepAt(scale, aids.pxPerMm());
  const status = zoomStatus(aids);
  return (
    <>
      {ZOOM_STEPS.map((z) => (
        <button
          key={String(z)}
          className={z === "fit" ? "btn sm" : "btn sm ghost bb-zoom"}
          data-nova-anchor={zoomAnchor(z)}
          style={z !== "fit" && z === lit ? { color: "var(--accent-text)", fontWeight: "var(--fw-semibold)" } : undefined}
          title={zoomTitle(z)}
          onClick={() => zoomTo(z, aids)}
        >
          {zoomLabel(z)}
        </button>
      ))}
      {status && (
        <span className="stat" data-nova-anchor="c.uncalibrated" title={t("c.zoom.uncalibrated.title")}>
          {status}
        </span>
      )}
    </>
  );
}
