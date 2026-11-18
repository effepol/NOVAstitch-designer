// Module c, the screen's calibration window: a line of known length in CSS px,
// measured with a real ruler on the screen where the design is, and the length
// typed in mm. Save → screen.pxPerMm and screen.calibrated (calibration.ts).

import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Dialog } from "../../components/ui";
import { useStore } from "../../store";
import { t, useLanguage } from "../core/i18n";
import { calibrateScreen, pxPerMmFrom } from "./calibration";
import type { ViewAids } from "./settings";
import "./texts";

/** The line's length: 500 CSS px, shorter on a narrow window. */
export const rulerPx = (windowWidth: number): number => Math.max(100, Math.min(500, Math.floor((windowWidth - 120) / 50) * 50));

const fmt = (v: number) => v.toFixed(3);

export function CalibrationDialog({ aids, onClose }: { aids: ViewAids; onClose: () => void }) {
  useLanguage();
  const px = rulerPx(typeof window !== "undefined" ? window.innerWidth : 600);
  const [text, setText] = useState("");
  const mm = Number(text.replace(",", "."));
  let result: number | null = null;
  try {
    result = text.trim() ? pxPerMmFrom(px, mm) : null;
  } catch {
    result = null;
  }
  const save = async () => {
    if (result == null) return;
    try {
      await calibrateScreen(aids, px, mm);
      useStore.getState().toast(t("c.calibrate.done"));
      onClose();
    } catch (e) {
      useStore.getState().toast(String(e instanceof Error ? e.message : e), "error");
    }
  };
  return (
    <Dialog
      title={t("c.calibrate.title")}
      nova="c"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("c.calibrate.cancel")}
          </button>
          <button className="btn primary" data-nova-anchor="c.calibrate.save" disabled={result == null} onClick={save}>
            {t("c.calibrate.save")}
          </button>
        </>
      }
    >
      <div data-nova-anchor="c.calibrate.dialog">
        <p>{t("c.calibrate.intro")}</p>
        <div data-nova-anchor="c.calibrate.ruler" style={{ width: px, margin: "16px 0 4px" }}>
          <div style={{ display: "flex", alignItems: "stretch", height: 24 }}>
            <div style={{ borderLeft: "2px solid currentColor" }} />
            <div style={{ flex: 1, borderBottom: "2px solid currentColor", marginBottom: 11 }} />
            <div style={{ borderLeft: "2px solid currentColor" }} />
          </div>
          <small>{t("c.calibrate.ruler", { px })}</small>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
          {t("c.calibrate.measured")}
          <input
            className="input"
            data-nova-anchor="c.calibrate.measured"
            inputMode="decimal"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void save()}
            style={{ width: 90 }}
          />
        </label>
        <p>
          <small>{text.trim() ? (result != null ? t("c.calibrate.result", { px: fmt(result) }) : t("c.calibrate.invalid")) : aids.calibrated() ? t("c.calibrate.current", { px: fmt(aids.pxPerMm()) }) : t("c.calibrate.none")}</small>
        </p>
      </div>
    </Dialog>
  );
}

let open: { root: Root; host: HTMLElement } | null = null;

/** Opens the calibration window over the app (once). */
export function openCalibration(aids: ViewAids): void {
  if (open || typeof document === "undefined") return;
  const host = document.createElement("div");
  host.dataset.nova = "c";
  document.body.appendChild(host);
  const root = createRoot(host);
  open = { root, host };
  const close = () => {
    const o = open;
    open = null;
    // after the click that closed it has finished
    setTimeout(() => {
      o?.root.unmount();
      o?.host.remove();
    }, 0);
  };
  root.render(<CalibrationDialog aids={aids} onClose={close} />);
}
