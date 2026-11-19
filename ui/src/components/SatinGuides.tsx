// Satin direction guides: the actions shared by the Properties panel and the
// stitch direction tool's context bar.

import { Sparkles, Trash2 } from "lucide-react";
import { StitchAngle } from "../icons/stitch";
import { autoGuides, guidesOf, selectedSatin, setGuides } from "../lib/satinGuides";
import { useStore } from "../store";
import { t, tn } from "../nova/i18n/filum";

export function GuideActions({ compact = false }: { compact?: boolean }) {
  // re-render with the document
  useStore((s) => s.doc);
  const tool = useStore((s) => s.tool);
  const o = selectedSatin();
  if (!o) return <span className="stat">{compact ? t("filum.pannelli.choose_a_satin_column") : ""}</span>;
  const n = guidesOf(o).length;
  const auto = () => {
    const g = autoGuides(o);
    if (!g.length) useStore.getState().toast(t("filum.pannelli.no_sharp_corners_on_this"));
    else setGuides(o.id, g);
  };
  return (
    <div className="guide-actions">
      <span className="stat">{n ? tn("filum.pannelli.n_guides", n) : t("filum.pannelli.across_2")}</span>
      {!compact && tool !== "guides" && (
        <button className="btn sm" title={t("filum.pannelli.edit_the_guides_on_the")} onClick={() => useStore.getState().setTool("guides")}>
          <StitchAngle size={12} />{t("filum.pannelli.edit_3")}
        </button>
      )}
      <button className="btn sm ghost" title={t("filum.pannelli.guides_along_the_mitre_of")} onClick={auto}>
        <Sparkles size={12} />{t("filum.pannelli.corners")}
      </button>
      {n > 0 && (
        <button className="btn sm ghost" title={t("filum.pannelli.remove_all_guides_stitches_straight")} onClick={() => setGuides(o.id, [])}>
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}
