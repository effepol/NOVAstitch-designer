// Routing (Ink/Stitch auto-route running stitch, auto-route satin columns,
// redwork, jump to stroke): one dialog with the options of each; the quick
// buttons in the context bar run with the options remembered here.

import { type LucideIcon } from "lucide-react";
import { Jump, StitchRunning, StitchSatin } from "../icons/stitch";
import { useState } from "react";
import { autoRouteSatins, autoRouteSelection, autoSatinOptions, jumpsToStrokes, setAutoSatinOptions } from "../lib/autoRoute";
import { useStore } from "../store";
import { Dialog, Num, Row, Toggle } from "./ui";
import { safeSetItem } from "../lib/storage";
import { t } from "../nova/i18n/filum";

export type RouteTab = "running" | "satin" | "jumps";
let pendingTab: RouteTab | null = null;

/** Open the route dialog on one of its tabs. */
export function openRoute(tab: RouteTab) {
  pendingTab = tab;
  useStore.getState().setDialog("route");
}

const KEY = "filum.route";
interface RouteOptions {
  redwork: boolean;
  jumpMin: number;
  jumpMax: number;
}
const DEFAULTS: RouteOptions = { redwork: false, jumpMin: 1, jumpMax: 15 };
export function routeOptions(): RouteOptions {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

const TAB_ICONS: Record<RouteTab, LucideIcon> = { running: StitchRunning, satin: StitchSatin, jumps: Jump };
const TABS = (): [RouteTab, string, string][] => [
  ["running", t("filum.finestre.running_stitch"), t("filum.finestre.one_path_through_the_selected")],
  ["satin", t("filum.finestre.satin_columns"), t("filum.finestre.one_sewing_order_through_the")],
  ["jumps", t("filum.finestre.jumps"), t("filum.finestre.short_jumps_between_objects_of")],
];

function TabButton({ id, label, title, on, onClick }: { id: RouteTab; label: string; title: string; on: boolean; onClick: () => void }) {
  const Icon = TAB_ICONS[id];
  return (
    <button title={title} className={on ? "on" : ""} onClick={onClick}>
      <Icon size={13} /> {label}
    </button>
  );
}

export function RouteDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<RouteTab>(() => {
    const t = pendingTab ?? "running";
    pendingTab = null;
    return t;
  });
  const [o, setO] = useState(routeOptions);
  const [satin, setSatin] = useState(autoSatinOptions);
  const hasSel = useStore((s) => s.selection.length > 0);
  const set = (p: Partial<RouteOptions>) =>
    setO((v) => {
      const next = { ...v, ...p };
      safeSetItem(KEY, JSON.stringify(next));
      return next;
    });
  const flip = (k: keyof typeof satin) => {
    const next = { ...satin, [k]: !satin[k] };
    setSatin(next);
    setAutoSatinOptions(next);
  };
  const run = () => {
    const err = tab === "running" ? autoRouteSelection(o.redwork) : tab === "satin" ? autoRouteSatins() : jumpsToStrokes(o.jumpMin, o.jumpMax);
    if (err) return useStore.getState().toast(err, "error");
    onClose();
  };
  return (
    <Dialog
      title={t("filum.finestre.route")}
      onClose={onClose}
      footer={
        <>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>
            {t("filum.finestre.cancel")}
          </button>
          <button className="btn primary" disabled={tab !== "jumps" && !hasSel} onClick={run}>
            {tab === "jumps" ? t("filum.finestre.convert_jumps") : t("filum.finestre.route")}
          </button>
        </>
      }
    >
      <div className="seg seg-full" style={{ marginBottom: 10 }}>
        {TABS().map(([id, label, title]) => (
          <TabButton key={id} id={id} label={label} title={title} on={tab === id} onClick={() => setTab(id)} />
        ))}
      </div>
      {tab === "running" && (
        <>
          <Row label={t("filum.finestre.out_and_back")} title={t("filum.finestre.redwork_every_line_sewn_twice")}>
            <Toggle on={o.redwork} onChange={(v) => set({ redwork: v })} />
          </Row>
          <p className="hint">{o.redwork ? t("filum.finestre.every_line_is_sewn_out") : t("filum.finestre.lines_are_joined_into_as")}</p>
        </>
      )}
      {tab === "satin" && (
        <>
          <Row label={t("filum.finestre.trim")} title={t("filum.finestre.trim_between_parts_that_do")}>
            <Toggle on={satin.trim} onChange={() => flip("trim")} />
          </Row>
          <Row label={t("filum.finestre.keep_order")} title={t("filum.finestre.keep_the_order_of_the")}>
            <Toggle on={satin.preserveOrder} onChange={() => flip("preserveOrder")} />
          </Row>
          <Row label={t("filum.finestre.keep_originals")} title={t("filum.finestre.keep_the_original_satins_hidden")}>
            <Toggle on={satin.keepOriginals} onChange={() => flip("keepOriginals")} />
          </Row>
          <p className="hint">{t("filum.finestre.running_lines_in_the_selection")}</p>
        </>
      )}
      {tab === "jumps" && (
        <>
          <Row label={t("filum.finestre.shortest")} title={t("filum.finestre.jumps_shorter_than_this_stay")}>
            <Num value={o.jumpMin} unit="mm" step={0.5} min={0} max={o.jumpMax} onChange={(v) => set({ jumpMin: v })} />
          </Row>
          <Row label={t("filum.finestre.longest")} title={t("filum.finestre.longer_jumps_stay_jumps_and")}>
            <Num value={o.jumpMax} unit="mm" step={1} min={o.jumpMin} max={100} onChange={(v) => set({ jumpMax: v })} />
          </Row>
          <p className="hint">{hasSel ? t("filum.finestre.between_the_selected_objects") : t("filum.finestre.across_the_whole_design_select")}{t("filum.finestre.only_jumps_within_one_colour")}</p>
        </>
      )}
    </Dialog>
  );
}
