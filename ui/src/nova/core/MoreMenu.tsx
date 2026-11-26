// «More» (three dots, module 0): a button that opens a menu of the items that
// have no room (the bottom bar's buttons, the layers panel's module tabs).
// The button is module 0's (data-nova="core"); the items keep their own marks.

import { Ellipsis } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { t } from "./i18n";

export function MoreMenu({ children, below, label = true }: { children: ReactNode; below?: boolean; label?: boolean }) {
  const [at, setAt] = useState<{ right: number; top?: number; bottom?: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!at) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAt(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [at]);
  return (
    <div ref={ref} className="bb-more-wrap">
      <button
        data-nova="core"
        className={`${label ? "btn sm" : "icon-btn"} bb-overflow ${at ? "on" : ""}`}
        title={t("core.bar.more")}
        aria-label={t("core.bar.more")}
        aria-haspopup="menu"
        aria-expanded={!!at}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const right = window.innerWidth - r.right;
          setAt(at ? null : below ? { right, top: r.bottom + 4 } : { right, bottom: window.innerHeight - r.top + 4 });
        }}
      >
        <Ellipsis size={14} />
        {label && <span className="bb-label">{t("core.bar.more")}</span>}
      </button>
      {at && (
        <div className="menu bb-overflow-menu" role="menu" style={{ right: at.right, top: at.top, bottom: at.bottom, minWidth: 160 }} onClick={() => setAt(null)}>
          {children}
        </div>
      )}
    </div>
  );
}
