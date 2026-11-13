// The About window (module 0, branding 13/11): name and version, what the program
// is, the Filum it is based on and who makes it, in Italian and English, with
// the licence (LICENSE), the credits (NOTICE and the font licences) and Close.

import { useState } from "react";
import license from "../../../../LICENSE?raw";
import notice from "../../../../NOTICE?raw";
import pkg from "../../../package.json";
import { Dialog } from "../../components/ui";
import { LicensesDialog } from "../../components/Licenses";
import { t, useLanguage } from "./i18n";

/** The version of the package (ui/package.json). */
export const APP_VERSION: string = pkg.version;

type View = "about" | "license" | "credits" | "fonts";

export function AboutDialog({ onClose }: { onClose: () => void }) {
  useLanguage();
  const [view, setView] = useState<View>("about");
  if (view === "fonts") return <LicensesDialog onClose={() => setView("credits")} initialTab="embroidery" />;
  const back = view !== "about";
  const footer = (
    <>
      {back ? (
        <button className="btn sm" onClick={() => setView("about")}>
          {t("core.about.back")}
        </button>
      ) : (
        <>
          <button className="btn sm" onClick={() => setView("license")}>
            {t("core.about.license")}
          </button>
          <button className="btn sm" onClick={() => setView("credits")}>
            {t("core.about.credits")}
          </button>
        </>
      )}
      {view === "credits" && (
        <button className="btn sm" onClick={() => setView("fonts")}>
          {t("core.about.fontLicenses")}
        </button>
      )}
      <span className="spacer" />
      <button className="btn sm primary" onClick={onClose}>
        {t("core.about.close")}
      </button>
    </>
  );
  const title = view === "license" ? t("core.about.license") : view === "credits" ? t("core.about.credits") : t("core.about.title");
  return (
    <Dialog wide={back} title={title} onClose={onClose} footer={footer} nova="core">
      {view === "about" && (
        <div className="lic-app" data-nova-anchor="core.about">
          <img src="/icon.png" alt="" width={96} height={96} style={{ display: "block", margin: "0 auto" }} />
          <p>
            <b>{t("core.about.line", { version: APP_VERSION })}</b>
          </p>
          <p>{t("core.about.what")}</p>
          <p>{t("core.about.base")}</p>
          <p>{t("core.about.who")}</p>
        </div>
      )}
      {view === "license" && <pre className="lic-full">{license}</pre>}
      {view === "credits" && <pre className="lic-full">{notice}</pre>}
    </Dialog>
  );
}
