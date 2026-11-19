// The preset card (module e): a compact card beside Filum's fabric picker,
// with the preset in force, its structured fields and its info sheet. Not
// blocking, closable. Module 0's hook (Material panel) shows it; until that is
// in main it is not on screen.

import { X } from "lucide-react";
import type { StitchDocument } from "../../types";
import { getLanguage, t, useLanguage } from "../core/i18n";
import { exportSummary } from "./summary";
import "./texts";

/** Follows the program's language. */
export function PresetCard(props: { doc: StitchDocument; onClose: () => void }) {
  useLanguage();
  return <PresetCardView {...props} />;
}

/** The card itself, in the current language. */
export function PresetCardView({ doc, onClose }: { doc: StitchDocument; onClose: () => void }) {
  const { preset, needlePoint } = exportSummary(doc);
  if (!preset) return null;
  const lang = getLanguage();
  return (
    <div className="mt-card" data-nova-anchor="e.presetCard">
      <p className="mt-effect">
        <strong>{t("e.card.title", { name: preset.name[lang] })}</strong>
        <button className="icon-btn" title={t("e.close")} aria-label={t("e.close")} data-nova-anchor="e.presetCard.close" onClick={onClose}>
          <X size={12} />
        </button>
      </p>
      <dl className="mt-advice">
        <dt>{t("e.stabilizer")}</dt>
        <dd>{t(`e.stabilizer.${preset.stabilizer.type}`)}, {t(`e.weight.${preset.stabilizer.weight}`)}</dd>
        <dt>{t("e.topping")}</dt>
        <dd>{t(`e.topping.${preset.topping}`)}</dd>
        <dt>{t("e.needle")}</dt>
        <dd>{t(`e.needle.${needlePoint}`)}</dd>
      </dl>
      <p className="mt-note">{preset.info[lang]}</p>
    </div>
  );
}
