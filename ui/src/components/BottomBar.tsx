import { Ellipsis, Focus, Video } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Hoop, Spool, StitchOut } from "../icons/stitch";
import { fit } from "../lib/actions";
import { closePlayer, play, recordVideo, usePlayback } from "./StitchOut";
import { useStore } from "../store";
import { fmtTime } from "./ui";
import { STITCH_COLORS, colorSequence, threadUsage } from "../lib/threads";
import { threadTitle } from "./ThreadPicker";
import { oneToOneScale, toolbarButtons, useRegistry } from "../nova/core/registry";
import { useLanguage } from "../nova/core/i18n";
import { t } from "../nova/i18n/filum";
import { t as coreT } from "../nova/core/i18n";
import { hiddenForWidth, overflowOrder } from "../nova/core/barOverflow";

export function BottomBar() {
  // NOVAstitch: registered buttons and their texts follow registrations and the language
  useRegistry();
  useLanguage();
  const doc = useStore((s) => s.doc);
  const plan = useStore((s) => s.plan);
  // only whether the player is open: the bar doesn't redraw on every stitch while it plays
  const playerOpen = useStore((s) => s.anim.index != null);
  const view = useStore((s) => s.view);
  const activeThread = useStore((s) => s.activeThread);
  const colorFocus = useStore((s) => s.colorFocus);
  const stitchColors = useStore((s) => s.stitchColors);
  const set = useStore((s) => s.set);
  const total = plan?.flags.length ?? 0;
  usePlayback();

  const stats = plan?.stats;
  // threads in sew order (first use), with how many colour blocks each has
  const usage = threadUsage(doc, plan);
  const seq = colorSequence(doc, plan);
  const sewOrder: { t: (typeof doc.threads)[number]; n: number }[] = [];
  for (const b of seq) {
    const t = b.threadId ? doc.threads.find((x) => x.id === b.threadId) : undefined;
    if (!t) continue;
    const hit = sewOrder.find((x) => x.t.id === t.id);
    if (hit) hit.n++;
    else sewOrder.push({ t, n: 1 });
  }
  for (const t of doc.threads) if (!sewOrder.some((x) => x.t.id === t.id) && doc.objects.some((o) => o.thread === t.id)) sewOrder.push({ t, n: 0 });
  // NOVAstitch (Signor Poletti, 18/11): 0.5×, 1×, 2×, 4×, 6× (no 3×); 1× from the screen
  // calibration a module registers (module c), else 96/25.4
  const zooms = [0.5, 1, 2, 4, 6];
  const actual = oneToOneScale();
  // NOVAstitch (Signor Poletti, 25/11): every button stays reachable; without room the least used go into «More»
  const registered = toolbarButtons();
  const order = overflowOrder(Array.from(zooms, (z) => `zoom:${z}`), registered.map((b) => b.id));
  const { barRef, hidden, measuring } = useBarOverflow(order, `${sewOrder.length}|${registered.map((b) => b.id).join()}|${playerOpen}|${stats?.stitches ?? 0}`);
  const shown = (key: string) => measuring || !hidden.includes(key);
  const zoomButton = (z: number, inMenu = false) => (
    <button
      key={z}
      data-bar-key={inMenu ? undefined : `zoom:${z}`}
      data-nova={z === 2 || z === 4 ? "core" : undefined}
      className={inMenu ? "menu-item" : "btn sm ghost bb-zoom"}
      style={Math.abs(view.scale / actual - z) < 0.02 ? { color: "var(--accent-text)", fontWeight: "var(--fw-semibold)" } : undefined}
      title={z === 1 ? t("filum.barre.zoom_1_actual_size") : z === 2 || z === 4 ? coreT("core.zoom.title", { z }) : t("filum.barre.zoom_z", { z })}
      onClick={() => fit(z)}
    >
      {z}×
    </button>
  );
  const registeredButton = (b: (typeof registered)[number], inMenu = false) => (
    <button key={b.id} data-bar-key={inMenu ? undefined : b.id} data-nova={b.module} data-nova-anchor={b.anchor} className={inMenu ? "menu-item" : "btn sm ghost"} title={b.title ? t(b.title) : undefined} onClick={b.run} style={b.active?.() ? { color: "var(--accent-text)", fontWeight: "var(--fw-semibold)" } : undefined}>
      {t(b.label)}
    </button>
  );
  const videoButton = (inMenu = false) => (
    <button key="video" data-bar-key={inMenu ? undefined : "video"} className={inMenu ? "menu-item" : "btn sm"} onClick={recordVideo} disabled={!total} title={t("filum.barre.record_a_stitch_out_video")}>
      <Video size={14} /> <span className={inMenu ? undefined : "bb-label"}>{t("filum.barre.video")}</span>
    </button>
  );
  const inMenu: ReactNode[] = measuring
    ? []
    : order.filter((k) => hidden.includes(k)).reverse().map((k) => {
        if (k === "video") return videoButton(true);
        if (k.startsWith("zoom:")) return zoomButton(Number(k.slice(5)), true);
        const b = registered.find((x) => x.id === k);
        return b ? registeredButton(b, true) : null;
      });
  return (
    <div className="bottombar" ref={barRef}>
      <div className="swatches">
        {sewOrder.map(({ t: th, n }, i) => {
          const u = usage.get(th.id);
          return (
            <button
              key={th.id}
              title={`${i + 1}. ${threadTitle(th)}${u && u.stitches ? `${t("filum.barre.thread_stats", { stitches: u.stitches.toLocaleString(), metres: u.metres.toFixed(1) })}${n > 1 ? t("filum.barre.sewn_in_n_blocks", { n }) : ""}` : ""}${t("filum.barre.thread_click")}${colorFocus ? t("filum.barre.and_show_only_this_colour") : ""}${t("filum.barre.thread_double_click")}`}
              className={`${activeThread === th.id ? "active" : ""} ${colorFocus && activeThread !== th.id ? "dim" : ""}`}
              style={{ background: th.color }}
              onClick={() => {
                const s = useStore.getState();
                s.select(s.doc.objects.filter((o) => o.thread === th.id).map((o) => o.id));
                s.set({ activeThread: th.id });
              }}
              onDoubleClick={() => useStore.getState().setDialog("threads")}
            >
              {n > 1 && <sub>{n}</sub>}
            </button>
          );
        })}
      </div>
      <div className="color-tools">
        <button
          className={`icon-btn ${colorFocus ? "on" : ""}`}
          style={{ border: 0, width: 24 }}
          title={t("filum.barre.show_only_the_active_colour")}
          disabled={!activeThread}
          onClick={() => set({ colorFocus: !colorFocus })}
        >
          <Focus size={15} />
        </button>
        <select className="select stitch-colors" value={stitchColors} title={t("filum.barre.colour_the_stitches_by")} onChange={(e) => set({ stitchColors: e.target.value as typeof stitchColors })}>
          {STITCH_COLORS.map((c) => (
            <option key={c.id} value={c.id} title={c.title}>
              {c.label}
            </option>
          ))}
        </select>
        <button className="icon-btn" style={{ border: 0, width: 24 }} title={t("filum.barre.thread_colours_2")} onClick={() => useStore.getState().setDialog("threads")}>
          <Spool size={15} />
        </button>
      </div>
      <div className="vsep" />
      <button className="btn sm" title={t("filum.barre.fit_design_shift_0")} onClick={() => fit("design")}>
        {t("filum.barre.fit")}
      </button>
      <button className="icon-btn" title={t("filum.barre.fit_hoop_0")} onClick={() => fit("hoop")}>
        <Hoop size={15} />
      </button>
      {zooms.map((z) => (shown(`zoom:${z}`) ? zoomButton(z) : null))}
      {/* NOVAstitch: buttons registered by the modules (nova/core/registry) */}
      {registered.filter((b) => shown(b.id)).map((b) => registeredButton(b))}
      <div className="vsep" />
      <span className="stat">
        {(stats?.stitches ?? 0).toLocaleString()}{t("filum.barre.stitches")}
        {stats && <span className="bb-more">{t("filum.barre.v1_v2_mm_v3", { v1: stats.width.toFixed(0), v2: stats.height.toFixed(0), v3: fmtTime(stats.seconds) })}</span>}
      </span>
      <div className="spacer" />
      <button
        className={`btn sm ${playerOpen ? "primary" : ""}`}
        disabled={!total}
        onClick={() => (playerOpen ? closePlayer() : play())}
        title={playerOpen ? t("filum.barre.close_the_stitch_out_player") : t("filum.barre.animate_the_stitch_out_with")}
      >
        <StitchOut size={14} /> <span className="bb-label">{t("filum.barre.animate")}</span>
      </button>
      {shown("video") && videoButton()}
      {/* measured too while every button is shown, so its own width is known */}
      {(measuring || inMenu.length > 0) && <MoreMenu>{inMenu}</MoreMenu>}
    </div>
  );
}

/** NOVAstitch: the bar's width, and which buttons go into «More» (nova/core/barOverflow.ts). */
function useBarOverflow(order: string[], content: string) {
  const barRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [state, setState] = useState<{ sig: string; hidden: string[] }>({ sig: "", hidden: [] });
  const sig = `${width}|${order.join()}|${content}`;
  // a new width, set of buttons or content: one pass with every button shown, measured before the paint
  const measuring = state.sig !== sig;
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!measuring || !bar) return;
    const gap = parseFloat(getComputedStyle(bar).columnGap) || 0;
    const widths = new Map<string, number>();
    for (const el of bar.querySelectorAll<HTMLElement>("[data-bar-key]")) widths.set(el.dataset.barKey!, el.getBoundingClientRect().width + gap);
    const extra = [...widths.values()].reduce((a, b) => a + b, 0);
    const more = bar.querySelector<HTMLElement>(".bb-more-wrap");
    const moreWidth = more ? more.getBoundingClientRect().width + gap : 0;
    const fixed = bar.scrollWidth - extra - moreWidth;
    // 2 px to spare: widths are fractional, the bar's are whole pixels
    setState({ sig, hidden: hiddenForWidth(order, widths, fixed, bar.clientWidth - 2, moreWidth) });
  });
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const ro = new ResizeObserver(() => setWidth(Math.round(bar.clientWidth)));
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);
  return { barRef, hidden: state.hidden, measuring };
}

/** NOVAstitch: «More», the buttons that have no room in the bar. */
function MoreMenu({ children }: { children: ReactNode }) {
  const [at, setAt] = useState<{ right: number; bottom: number } | null>(null);
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
        className={`btn sm bb-overflow ${at ? "on" : ""}`}
        title={coreT("core.bar.more_title")}
        aria-haspopup="menu"
        aria-expanded={!!at}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt(at ? null : { right: window.innerWidth - r.right, bottom: window.innerHeight - r.top + 4 });
        }}
      >
        <Ellipsis size={14} /> <span className="bb-label">{coreT("core.bar.more")}</span>
      </button>
      {at && (
        <div className="menu bb-overflow-menu" role="menu" style={{ right: at.right, bottom: at.bottom, minWidth: 160 }} onClick={() => setAt(null)}>
          {children}
        </div>
      )}
    </div>
  );
}
