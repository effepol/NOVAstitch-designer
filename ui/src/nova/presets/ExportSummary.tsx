// The summary at export (module e): what to put in the machine before sewing,
// not blocking and closable. Its data come from module l's sheetData
// (summary.ts), so the thread metres are the work sheet's (contract test l.7).
// Shown in module 0's space in the export dialog.

import { TriangleAlert, X } from "lucide-react";
import type { PlanData, StitchDocument } from "../../types";
import { metres } from "../worksheet/format";
import { getLanguage, t, useLanguage } from "../core/i18n";
import { exportSummary } from "./summary";
import "./texts";

/** Follows the program's language. */
export function ExportSummary(props: { doc: StitchDocument; plan?: PlanData | null; onClose: () => void }) {
  useLanguage();
  return <ExportSummaryView {...props} />;
}

/** The card itself, in the current language. */
export function ExportSummaryView({ doc, plan = null, onClose }: { doc: StitchDocument; plan?: PlanData | null; onClose: () => void }) {
  const { preset, needlePoint, boxes, thread } = exportSummary(doc, plan);
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
        {thread && (
          <>
            <dt>{t("e.summary.thread")}</dt>
            <dd>{t("e.summary.metres", { top: metres(thread.topM, lang), bobbin: metres(thread.bobbinM, lang) })}</dd>
          </>
        )}
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
