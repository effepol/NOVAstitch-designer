// Preferences ▸ Downloads: what Filum includes (and under which
// licences), and the optional packs it may not include — each with its
// licence, a one-click "Accept & download" and its progress, removal and
// updates. The packs come from public/downloads/*.json (lib/downloads.ts).

import { Check, ChevronRight, Download, ExternalLink, PackageCheck, RefreshCw, Scale, Trash2, Type, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Spool } from "../icons/stitch";
import { formatBytes, installPack, removePack, useDownloads, type DownloadPack, type InstalledPack, type Progress } from "../lib/downloads";
import { embroideryIndex } from "../lib/fonts";
import { useStore } from "../store";
import { ExtLink } from "./ui";
import { t, tData, tx } from "../nova/i18n/filum";

type Job = { progress: Progress; abort: AbortController } | { error: string };

export function DownloadsPanel() {
  const { packs, installed } = useDownloads();
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const f = () => setOnline(navigator.onLine);
    window.addEventListener("online", f);
    window.addEventListener("offline", f);
    return () => {
      window.removeEventListener("online", f);
      window.removeEventListener("offline", f);
    };
  }, []);
  // a running download stops when Preferences closes
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  useEffect(() => () => Object.values(jobsRef.current).forEach((j) => "abort" in j && j.abort.abort()), []);

  const setJob = (id: string, j: Job | null) =>
    setJobs((m) => {
      const n = { ...m };
      if (j) n[id] = j;
      else delete n[id];
      return n;
    });
  const start = async (pack: DownloadPack) => {
    const abort = new AbortController();
    setJob(pack.id, { progress: { done: 0, total: pack.bytes, stage: "download" }, abort });
    try {
      await installPack(pack, (progress) => setJob(pack.id, { progress, abort }), abort.signal);
      setJob(pack.id, null);
      useStore.getState().toast(t("filum.finestre.title_installed", { title: tData(`filum.finestre.pacchetto.${pack.id}.titolo`, pack.title) }), "success");
    } catch (e) {
      if ((e as Error).name === "AbortError") return setJob(pack.id, null);
      setJob(pack.id, { error: (e as Error).message || String(e) });
    }
  };
  const remove = async (pack: DownloadPack) => {
    if (!confirm(t("filum.finestre.remove_title_from_this_device", { title: tData(`filum.finestre.pacchetto.${pack.id}.titolo`, pack.title) }))) return;
    await removePack(pack.id, pack.kind);
    useStore.getState().toast(t("filum.finestre.title_removed", { title: tData(`filum.finestre.pacchetto.${pack.id}.titolo`, pack.title) }));
  };

  return (
    <>
      <section className="st-sec">
        <h4>{t("filum.finestre.optional_downloads")}</h4>
        <p className="dl-intro">
          {t("filum.finestre.filum_includes_only_what_it")}<b>{t("filum.finestre.accept_amp_download")}</b>{t("filum.finestre.they_come_straight_from_their")}
        </p>
      </section>
      {packs === null ? (
        <p className="hint">{t("filum.finestre.loading")}</p>
      ) : !packs.length ? (
        <p className="hint">{t("filum.finestre.this_version_of_filum_offers")}</p>
      ) : (
        packs.map((p) => <PackCard key={p.id} pack={p} installed={installed.get(p.id)} job={jobs[p.id]} online={online} onStart={() => start(p)} onRemove={() => remove(p)} />)
      )}
      <Included />
    </>
  );
}

function PackCard({
  pack,
  installed,
  job,
  online,
  onStart,
  onRemove,
}: {
  pack: DownloadPack;
  installed?: InstalledPack;
  job?: Job;
  online: boolean;
  onStart: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const running = job && "progress" in job ? job : null;
  const failed = job && "error" in job ? job.error : null;
  const outdated = !!installed && installed.version !== pack.version;
  const unit = pack.kind === "fonts" ? (pack.items.length === 1 ? "font" : "fonts") : pack.items.length === 1 ? "thread chart" : "thread charts";
  // no published licence: nothing to accept beyond using it for oneself
  const unlicensed = /^no licen[cs]e/i.test(pack.license.name);
  const pct = running ? Math.min(100, Math.round((running.progress.done / Math.max(1, running.progress.total)) * 100)) : 0;
  const licence = (
    <ExtLink href={pack.license.url} className="dl-link">
      {tData(`filum.finestre.pacchetto.${pack.id}.licenza`, pack.license.name)}
      <ExternalLink size={10} />
    </ExtLink>
  );
  return (
    <article className={`dl-card ${installed ? "installed" : ""}`}>
      <header className="dl-head">
        <span className="dl-icon">{pack.kind === "fonts" ? <Type size={17} /> : <Spool size={17} />}</span>
        <div className="dl-title">
          <b>{tData(`filum.finestre.pacchetto.${pack.id}.titolo`, pack.title)}</b>
          <span className="dl-meta">
            {pack.items.length} {unit} · {formatBytes(pack.bytes)}{t("filum.finestre.from")}{" "}
            <ExtLink href={pack.source.url} title={pack.source.label}>
              {t("filum.finestre.n_on_github", { n: pack.source.label.split("/")[0] })}</ExtLink>
          </span>
        </div>
        <span className={`dl-status ${installed ? (outdated ? "update" : "ok") : ""}`}>
          {installed ? (
            outdated ? (
              t("filum.finestre.update_available")
            ) : (
              <>
                <Check size={12} />{t("filum.finestre.installed")}
              </>
            )
          ) : (
            t("filum.finestre.not_installed")
          )}
        </span>
      </header>
      <p className="dl-sum">{tData(`filum.finestre.pacchetto.${pack.id}.descrizione`, pack.summary)}</p>
      <div className="dl-licence">
        <Scale size={15} />
        <div>
          <b>{tx("filum.finestre.licence_licence", { licence })}</b>
          <p>{tData(`filum.finestre.pacchetto.${pack.id}.condizioni`, pack.license.terms)}</p>
        </div>
      </div>
      <button className={`dl-items-toggle ${open ? "open" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        <ChevronRight size={12} />
        {t("filum.finestre.what_s_included")}
      </button>
      {open && (
        <ul className="dl-items">
          {pack.items.map((it) => (
            <li key={it.id}>
              <span>{it.name}</span>
              <span className="dl-item-meta">{it.count ? t("filum.finestre.count_colours", { count: it.count }) : formatBytes(it.files.reduce((n, f) => n + f[1], 0))}</span>
            </li>
          ))}
        </ul>
      )}
      <footer className="dl-foot">
        {running ? (
          <>
            <div className="dl-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${pct}%` }} />
            </div>
            <span className="dl-prog">
              {running.progress.stage === "convert" ? t("filum.finestre.preparing") : t("filum.finestre.v1_of_v2", { v1: formatBytes(running.progress.done), v2: formatBytes(running.progress.total) })}
            </span>
            <button className="btn sm ghost" onClick={() => running.abort.abort()}>
              <X size={13} />{t("filum.finestre.cancel_2")}
            </button>
          </>
        ) : installed && !outdated ? (
          <>
            <span className="dl-accepted">
              <PackageCheck size={14} />
              {unlicensed ? t("filum.finestre.downloaded_for_your_own_use", { v1: new Date(installed.acceptedAt).toLocaleDateString() }) : t("filum.finestre.you_accepted_license_on_v2", { license: installed.license, v2: new Date(installed.acceptedAt).toLocaleDateString() })}
            </span>
            <button className="btn sm ghost" onClick={onRemove}>
              <Trash2 size={13} />{t("filum.finestre.remove_2")}
            </button>
          </>
        ) : (
          <>
            <span className="dl-accept">
              {failed ? <span className="dl-err">{t("filum.finestre.download_failed_failed", { failed })}</span> : !online ? (
                t("filum.finestre.you_re_offline_connect_to")
              ) : unlicensed ? (
                <>{tx("filum.finestre.no_licence_is_published_licence", { licence })}</>
              ) : (
                <>{tx("filum.finestre.by_downloading_you_accept_the", { licence })}</>
              )}
            </span>
            {installed && (
              <button className="btn sm ghost" onClick={onRemove}>
                <Trash2 size={13} />{t("filum.finestre.remove_2")}
              </button>
            )}
            <button className="btn primary" disabled={!online} onClick={onStart}>
              {installed ? <RefreshCw size={14} /> : <Download size={14} />}
              {failed ? t("filum.finestre.try_again") : installed ? (unlicensed ? t("filum.finestre.update") : t("filum.finestre.accept_update")) : unlicensed ? t("filum.finestre.agree_download") : t("filum.finestre.accept_download")}
            </button>
          </>
        )}
      </footer>
    </article>
  );
}

/** What ships with Filum, by licence. */
function Included() {
  const [fonts, setFonts] = useState<{ n: number; licences: string[] } | null>(null);
  const [charts, setCharts] = useState<number | null>(null);
  useEffect(() => {
    embroideryIndex()
      .then((ix) => {
        const bundled = ix.fonts.filter((f) => !f.download);
        const norm = (l: string) => (/open font/i.test(l) ? "SIL OFL" : /mublic|public/i.test(l) ? "public domain" : l.replace(/^S(CC)/, "$1").replace(/^CC-/, "CC "));
        setFonts({ n: bundled.length, licences: [...new Set(bundled.map((f) => norm(f.license)))].sort() });
      })
      .catch(() => {});
    fetch("/palettes/index.json")
      .then((r) => r.json())
      .then((j: { charts: { download?: string }[] }) => setCharts(j.charts.filter((c) => !c.download).length))
      .catch(() => {});
  }, []);
  return (
    <section className="st-sec">
      <h4>{t("filum.finestre.included_with_filum")}</h4>
      <ul className="dl-included">
        <li>
          <Type size={13} />
          <span>{fonts ? t("filum.finestre.n_embroidery_fonts", { n: fonts.n }) : t("filum.finestre.embroidery_fonts")}</span>
          <span className="dl-item-meta">{fonts ? fonts.licences.map((l) => (l === "public domain" ? t("filum.finestre.public_domain") : l)).join(", ") : ""}</span>
        </li>
        <li>
          <Type size={13} />
          <span>{t("filum.finestre.n3_outline_fonts_nunito_bebas")}</span>
          <span className="dl-item-meta">{t("filum.finestre.sil_ofl")}</span>
        </li>
        <li>
          <Spool size={13} />
          <span>{charts ? t("filum.finestre.charts_thread_charts", { charts }) : t("filum.finestre.thread_charts")}{t("filum.finestre.from_ink_stitch_and_madeira")}</span>
          <span className="dl-item-meta">{t("filum.finestre.gpl_3_0_colours_sampled")}</span>
        </li>
        <li>
          <PackageCheck size={13} />
          <span>{t("filum.finestre.on_device_ai_models_mobilesam")}</span>
          <span className="dl-item-meta">{t("filum.finestre.mit_apache_2_0")}</span>
        </li>
      </ul>
      <p className="hint">
        {t("filum.finestre.filum_itself_is_free_software")}{" "}
        <button className="link" onClick={() => useStore.getState().setDialog("licenses")}>
          {t("filum.finestre.every_licence_and_its_full")}
        </button>
      </p>
    </section>
  );
}
