// Help → Licences: Filum's own licence and every third-party component it
// ships (embroidery fonts, outline fonts, ported code, npm packages, Rust
// crates) with full licence texts. Data: public/licenses/third-party.json
// (scripts/gen-licenses.mjs) and public/embroidery-fonts (scripts/bundle-fonts.mjs).

import { ChevronDown, ChevronRight, ExternalLink, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { embroideryIndex, embroideryLicense, type EmbroideryIndex } from "../lib/fonts";
import { Dialog, ExtLink } from "./ui";
import { t } from "../nova/i18n/filum";

interface Item {
  name: string;
  version: string;
  license: string;
  author: string;
  url: string;
  note?: string;
  files: { file: string; text: string | null }[];
}
interface ThirdParty {
  generated: string;
  /** licence text id (see texts) */
  app: { license: string; text: string };
  ported: Item[];
  fonts: Item[];
  npm: Item[];
  cargo: Item[];
  texts: Record<string, string>;
}

type Tab = "app" | "embroidery" | "fonts" | "ported" | "npm" | "cargo";

let dataP: Promise<ThirdParty> | null = null;
const thirdParty = () => {
  if (!dataP) {
    dataP = fetch("/licenses/third-party.json").then((r) => r.json() as Promise<ThirdParty>);
    dataP.catch(() => (dataP = null));
  }
  return dataP;
};

/** Embroidery fonts as licence items; texts load when a row is opened. */
const fontItems = (ix: EmbroideryIndex): (Item & { fontId: string; download?: string })[] =>
  ix.fonts.map((f) => ({
    fontId: f.id,
    download: f.download,
    name: f.name,
    version: f.download ? "optional download · not included" : "",
    license: f.license,
    author: f.original ? `Based on ${f.original}` : "",
    url: f.url,
    note: f.description,
    files: [],
  }));

function Row({ item, texts, loadText }: { item: Item; texts: Record<string, string>; loadText?: () => Promise<string> }) {
  const [open, setOpen] = useState(false);
  const [lazy, setLazy] = useState<string | null>(null);
  useEffect(() => {
    if (open && loadText && lazy === null) loadText().then((t) => setLazy(t || "No licence file is included with this font; see its stated licence."));
  }, [open, loadText, lazy]);
  return (
    <div className={`lic-row ${open ? "open" : ""}`}>
      <button className="lic-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <b>{item.name}</b>
        {item.version && <span className="lic-ver">{item.version}</span>}
        <span className="lic-spacer" />
        <span className="lic-badge">{item.license}</span>
      </button>
      {open && (
        <div className="lic-body">
          {(item.author || item.url || item.note) && (
            <p className="lic-meta">
              {item.note && <span>{item.note}</span>}
              {item.author && <span>{item.author}</span>}
              {item.url && (
                <ExtLink href={item.url}>
                  {item.url.replace(/^https?:\/\//, "")} <ExternalLink size={10} />
                </ExtLink>
              )}
            </p>
          )}
          {loadText ? (
            <pre>{lazy ?? t("filum.finestre.loading")}</pre>
          ) : item.files.length ? (
            item.files.map((f) => (
              <div key={f.file}>
                {item.files.length > 1 && <h4>{f.file}</h4>}
                <pre>{f.text ? texts[f.text] : ""}</pre>
              </div>
            ))
          ) : (
            <pre>{t("filum.finestre.licensed_under_license", { license: item.license })}</pre>
          )}
        </div>
      )}
    </div>
  );
}

/** `initialTab`: NOVAstitch's About ▸ Credits opens it on the embroidery fonts. */
export function LicensesDialog({ onClose, initialTab = "app" }: { onClose: () => void; initialTab?: Tab }) {
  const [data, setData] = useState<ThirdParty | null>(null);
  const [fonts, setFonts] = useState<EmbroideryIndex | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    thirdParty()
      .then(setData)
      .catch((e) => setError(String(e)));
    embroideryIndex()
      .then(setFonts)
      .catch(() => {});
  }, []);
  const embroidery = useMemo(() => (fonts ? fontItems(fonts) : []), [fonts]);
  const lists: Record<Exclude<Tab, "app">, Item[]> = {
    embroidery,
    fonts: data?.fonts ?? [],
    ported: data?.ported ?? [],
    npm: data?.npm ?? [],
    cargo: data?.cargo ?? [],
  };
  const tabs: [Tab, string][] = [
    ["app", "Filum"],
    ["embroidery", t("filum.finestre.embroidery_fonts_n", { n: embroidery.length })],
    ["fonts", t("filum.finestre.fonts_n", { n: lists.fonts.length })],
    ["ported", t("filum.finestre.ported_code")],
    ["npm", `JavaScript (${lists.npm.length})`],
    ["cargo", `Rust (${lists.cargo.length})`],
  ];
  const q = query.trim().toLowerCase();
  const items =
    tab === "app"
      ? []
      : lists[tab].filter((i) => !q || i.name.toLowerCase().includes(q) || i.license.toLowerCase().includes(q) || i.author.toLowerCase().includes(q));
  // licence summary of the current list
  const summary = useMemo(() => {
    if (tab === "app") return "";
    const n = new Map<string, number>();
    for (const i of lists[tab]) n.set(i.license, (n.get(i.license) ?? 0) + 1);
    return [...n.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([l, c]) => `${l} ×${c}`)
      .join(" · ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, data, embroidery]);

  return (
    <Dialog wide title={t("filum.finestre.licences")} onClose={onClose}>
      <div className="font-tabs">
        <div className="seg lic-tabs">
          {tabs.map(([id, label]) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab !== "app" && (
          <label className="ctx-field" style={{ flex: 1, minWidth: 160 }}>
            <Search size={13} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("filum.finestre.search")} style={{ width: "100%", textAlign: "left" }} />
          </label>
        )}
      </div>
      {error && <p className="hint warn">{t("filum.finestre.could_not_load_the_licence", { error })}</p>}
      {tab === "app" ? (
        <div className="lic-app">
          <p>
            {t("filum.finestre.filum_is_free_software_you")}<b>{t("filum.finestre.gnu_general_public_license")}</b>{t("filum.finestre.as_published_by_the_free")}
          </p>
          <p className="hint">
            {t("filum.finestre.embroidery_fonts_come_from_the")}
            {fonts?.commit ? ` (${fonts.source} @ ${fonts.commit.slice(0, 7)})` : ""}{t("filum.finestre.fonts_may_carry_their_own")}
            {data ? t("filum.finestre.licence_list_generated_generated", { generated: data.generated }) : ""}
          </p>
          <pre className="lic-full">{data ? data.texts[data.app.text] ?? "" : t("filum.finestre.loading")}</pre>
        </div>
      ) : (
        <>
          <p className="hint" style={{ padding: "6px 2px" }}>
            {tab === "embroidery" && t("filum.finestre.every_ink_stitch_embroidery_font")}
            {tab === "fonts" && t("filum.finestre.outline_fonts_bundled_for_lettering")}
            {tab === "ported" && t("filum.finestre.projects_whose_code_or_data")}
            {tab === "npm" && t("filum.finestre.javascript_packages_in_the_app")}
            {tab === "cargo" && t("filum.finestre.rust_crates_compiled_into_the")}
            {summary}
          </p>
          <div className="lic-list">
            {items.map((i) => (
              <Row
                key={`${i.name}@${i.version}`}
                item={i}
                texts={data?.texts ?? {}}
                loadText={
                  "fontId" in i
                    ? () =>
                        embroideryLicense((i as { fontId: string }).fontId).then(
                          (t) => t || ((i as { download?: string }).download ? `Not included with Filum: its licence (${i.license}) doesn't allow it. Download it in Preferences → Downloads to see the author's licence file here.` : ""),
                        )
                    : undefined
                }
              />
            ))}
            {!items.length && <p className="hint">{data || tab === "embroidery" ? t("filum.finestre.nothing_found") : t("filum.finestre.loading")}</p>}
          </div>
        </>
      )}
    </Dialog>
  );
}
