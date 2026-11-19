// The summary at export (module e): what to put in the machine before sewing,
// not blocking and closable. Module e's data (summary.ts) until module l's
// sheetData arrives. Module 0's hook (export dialog) shows it; until that is in
// main it is not on screen.

import { TriangleAlert, X } from "lucide-react";
import type { StitchDocument } from "../../types";
import { getLanguage, t, useLanguage } from "../core/i18n";
import { exportSummary } from "./summary";
import "./texts";

/** Follows the program's language. */
export function ExportSummary(props: { doc: StitchDocument; onClose: () => void }) {
  useLanguage();
  return <ExportSummaryView {...props} />;
}

/** The card itself, in the current language. */
export function ExportSummaryView({ doc, onClose }: { doc: StitchDocument; onClose: () => void }) {
  const { preset, needlePoint, boxes } = exportSummary(doc);
  const lang = getLanguage();
  return (
    <div className="mt-card" data-nova-anchor="e.exportSummary">
      <p className="mt-effect">
        <strong>{t("e.summary.title")}</strong>
        <button className="icon-btn" title={t("e.close")} aria-label={t("e.close")} data-nova-anchor="e.exportSummary.close" onClick={onClose}>
          <X size={12} />
        </button>
      </p>
      <dl className="mt-advice">
        <dt>{t("e.fabric")}</dt>
        <dd>{preset ? preset.name[lang] : t("e.summary.noPreset")}</dd>
        {preset && (
          <>
            <dt>{t("e.stabilizer")}</dt>
            <dd>{t(`e.stabilizer.${preset.stabilizer.type}`)}, {t(`e.weight.${preset.stabilizer.weight}`)}</dd>
            <dt>{t("e.topping")}</dt>
            <dd>{t(`e.topping.${preset.topping}`)}</dd>
          </>
        )}
        <dt>{t("e.needle")}</dt>
        <dd>{t(`e.needle.${needlePoint}`)}</dd>
      </dl>
      {boxes.map((b) => (
        <p key={b} className="mt-note conflict">
          <TriangleAlert size={12} /> <strong>{t(`e.box.${b}`)}</strong>
          {b !== "cap" && b !== "layered3d" && <> · {t(`e.box.${b}.note`)}</>}
        </p>
      ))}
    </div>
  );
}
