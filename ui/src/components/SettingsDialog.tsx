// Preferences: every setting of the app in one place, by section — look,
// canvas and editing, the machine of this design, export defaults, threads,
// the digitizer, optional downloads and files.

import { Brush, Cpu, Download, FileDown, FolderCog, Keyboard, MousePointer2 } from "lucide-react";
import { Digitize, Spool } from "../icons/stitch";
import { useState, type ReactNode } from "react";
import { machineById } from "../lib/machines";
import { MachineOptions } from "./MachineOptions";
import { DownloadsPanel } from "./DownloadsPanel";
import { ACCENTS, APP_COLOR, DEFAULT_PREFS } from "../lib/prefs";
import { loadMatchOptions, saveMatchOptions, useMyThreads } from "../lib/threads";
import { MATCH_PRESETS } from "../lib/threadMatch";
import { DEFAULT_TOOL_OPTIONS, useStore } from "../store";
import { Dialog, Num, Row, Toggle } from "./ui";
import { safeSetItem } from "../lib/storage";
import { t } from "../nova/i18n/filum";

type Tab = "appearance" | "canvas" | "export" | "threads" | "digitizer" | "downloads" | "files" | "keys";
const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "appearance", get label() { return t("filum.finestre.appearance"); }, icon: <Brush size={15} /> },
  { id: "canvas", get label() { return t("filum.finestre.editing"); }, icon: <MousePointer2 size={15} /> },
  { id: "export", get label() { return t("filum.finestre.export"); }, icon: <FileDown size={15} /> },
  { id: "threads", get label() { return t("filum.finestre.threads"); }, icon: <Spool size={15} /> },
  { id: "digitizer", get label() { return t("filum.finestre.digitizer"); }, icon: <Digitize size={15} /> },
  { id: "downloads", get label() { return t("filum.finestre.downloads"); }, icon: <Download size={15} /> },
  { id: "files", get label() { return t("filum.finestre.files_data"); }, icon: <FolderCog size={15} /> },
  { id: "keys", get label() { return t("filum.finestre.keyboard"); }, icon: <Keyboard size={15} /> },
];

function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string, string?][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([id, label, title]) => (
        <button key={String(id)} className={value === id ? "on" : ""} title={title} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="st-sec">
      <h4>{title}</h4>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </section>
  );
}

/** A remembered choice in local storage (export dialog defaults and the like). */
function useStored(key: string, fallback: string): [string, (v: string) => void] {
  const [v, setV] = useState(() => localStorage.getItem(key) ?? fallback);
  return [
    v,
    (x) => {
      safeSetItem(key, x);
      setV(x);
    },
  ];
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const stored = useStore((s) => s.settingsTab) as Tab;
  const tab: Tab = TABS.some((t) => t.id === stored) ? stored : "appearance";
  const setTab = (t: Tab) => useStore.setState({ settingsTab: t });
  return (
    <Dialog wide live title={t("filum.finestre.preferences")} onClose={onClose}>
      <div className="st">
        <nav className="st-nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
        <div className="st-body">
          {tab === "appearance" && <Appearance />}
          {tab === "canvas" && <CanvasPrefs />}
          {tab === "export" && <ExportPrefs />}
          {tab === "threads" && <ThreadPrefs />}
          {tab === "digitizer" && <DigitizerPrefs />}
          {tab === "downloads" && <DownloadsPanel />}
          {tab === "files" && <FilePrefs />}
          {tab === "keys" && <KeyPrefs />}
        </div>
      </div>
    </Dialog>
  );
}

function Appearance() {
  const theme = useStore((s) => s.theme);
  const prefs = useStore((s) => s.prefs);
  const { setTheme, setPrefs } = useStore.getState();
  const custom = !ACCENTS.some((a) => a.color === prefs.accent);
  return (
    <>
      <Section title={t("filum.finestre.theme")}>
        <Row label={t("filum.finestre.interface")}>
          <Seg
            value={theme}
            onChange={setTheme}
            options={[
              ["light", t("filum.finestre.light")],
              ["dark", t("filum.finestre.dark")],
            ]}
          />
        </Row>
      </Section>
      <Section title={t("filum.finestre.highlight_colour")} hint={t("filum.finestre.selections_active_tools_buttons_and")}>
        <div className="st-accents">
          {ACCENTS.map((a) => (
            <button key={a.color} className={prefs.accent === a.color ? "on" : ""} title={a.label} style={{ ["--c" as string]: a.color }} onClick={() => setPrefs({ accent: a.color })}>
              <i />
              <span>{a.color === APP_COLOR ? "Filum" : a.label}</span>
            </button>
          ))}
          <label className={`st-custom ${custom ? "on" : ""}`} title={t("filum.finestre.your_own_colour")}>
            <input type="color" value={prefs.accent} onChange={(e) => setPrefs({ accent: e.target.value })} />
            <span>{t("filum.finestre.custom")}</span>
          </label>
        </div>
      </Section>
    </>
  );
}

function CanvasPrefs() {
  const s = useStore();
  const p = s.prefs;
  return (
    <>
      <Section title={t("filum.finestre.snapping")} hint={t("filum.finestre.smart_guides_and_point_snapping")}>
        <Row label={t("filum.finestre.smart_guides")} title={t("filum.finestre.snap_to_other_objects_and")}>
          <Toggle on={s.smartGuides} onChange={(v) => s.set({ smartGuides: v })} />
        </Row>
        <Row label={t("filum.finestre.snap_to_points")} title={t("filum.finestre.pen_and_node_tool_new")}>
          <Toggle on={p.snapPoints} onChange={(v) => s.setPrefs({ snapPoints: v })} />
        </Row>
      </Section>
      <Section title={t("filum.finestre.arrow_keys")} hint={t("filum.finestre.shift_moves_by_the_larger")}>
        <Row label={t("filum.finestre.objects")}>
          <span className="dz-inline">
            <Num value={p.nudge} unit="mm" step={0.1} min={0.05} max={20} onChange={(v) => s.setPrefs({ nudge: v })} />
            <span className="stat">Shift</span>
            <Num value={p.nudgeBig} unit="mm" step={0.5} min={0.1} max={100} onChange={(v) => s.setPrefs({ nudgeBig: v })} />
          </span>
        </Row>
        <Row label={t("filum.finestre.points")}>
          <span className="dz-inline">
            <Num value={p.nodeNudge} unit="mm" step={0.05} min={0.01} max={10} onChange={(v) => s.setPrefs({ nodeNudge: v })} />
            <span className="stat">Shift</span>
            <Num value={p.nodeNudgeBig} unit="mm" step={0.1} min={0.05} max={50} onChange={(v) => s.setPrefs({ nodeNudgeBig: v })} />
          </span>
        </Row>
      </Section>
      <Section title={t("filum.finestre.drawing_tools")} hint={t("filum.finestre.each_tool_remembers_its_settings")}>
        <button
          className="btn sm"
          onClick={() => {
            for (const k of Object.keys(DEFAULT_TOOL_OPTIONS) as (keyof typeof DEFAULT_TOOL_OPTIONS)[]) s.setToolOptions(k, DEFAULT_TOOL_OPTIONS[k]);
          }}
        >
          {t("filum.finestre.reset_every_tool_s_settings")}
        </button>
      </Section>
    </>
  );
}

function ExportPrefs() {
  const [fmt, setFmt] = useStored("filum.format", "pes");
  const [pes, setPes] = useStored("filum.pesVersion", "1");
  const [mid, setMid] = useStored("filum.machine", "doc");
  const [frame, setFrame] = useStored("filum.frame", "");
  const machine = machineById(mid);
  return (
    <>
      <Section title={t("filum.finestre.export")} hint={t("filum.finestre.the_export_dialog_starts_with")}>
        <Row label={t("filum.finestre.format")}>
          <select className="select" value={fmt} onChange={(e) => setFmt(e.target.value)}>
            {["pes", "dst", "jef", "exp", "vp3", "xxx", "pec", "u01", "tbf", "sew", "gcode", "csv", "txt", "col", "edr", "inf", "svg", "filum"].map((f) => (
              <option key={f} value={f}>
                .{f.toUpperCase()}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t("filum.finestre.pes_version")}>
          <Seg
            value={pes}
            onChange={setPes}
            options={[
              ["1", t("filum.finestre.pes_v1_brother_colours"), t("filum.finestre.most_compatible_what_ink_stitch")],
              ["6", t("filum.finestre.pes_v6_exact_threads"), t("filum.finestre.adds_the_exact_thread_list")],
            ]}
          />
        </Row>
      </Section>
      <Section title={t("filum.finestre.machine_for_new_designs")} hint={t("filum.finestre.each_design_keeps_its_own")}>
        <Row label={t("filum.finestre.new_designs")} title={t("filum.finestre.the_machine_new_designs_start")}>
          <select
            className="select"
            value={mid}
            onChange={(e) => {
              setMid(e.target.value);
              setFrame("");
            }}
          >
            <MachineOptions />
          </select>
        </Row>
        {machine.frames.length > 0 && (
          <Row label={t("filum.finestre.hoop")} title={t("filum.finestre.the_frame_new_designs_start")}>
            <select className="select" value={frame} onChange={(e) => setFrame(e.target.value)}>
              <option value="">{t("filum.finestre.default_100_100_mm")}</option>
              {machine.frames.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Row>
        )}
        <p className="hint">{machine.models}</p>
      </Section>
    </>
  );
}

function ThreadPrefs() {
  const mine = useMyThreads();
  const [match, setMatch] = useState(loadMatchOptions);
  return (
    <>
      <Section title={t("filum.finestre.matching")} hint={MATCH_PRESETS.find((p) => p.id === match.preset)?.hint ?? t("filum.finestre.your_own_settings_thread_colours")}>
        <Row label={t("filum.finestre.fit_threads")}>
          <select
            className="select"
            value={match.preset}
            onChange={(e) => {
              const p = MATCH_PRESETS.find((x) => x.id === e.target.value);
              if (!p) return;
              const next = { ...match, ...p.opts, weights: { ...match.weights, ...(p.opts.weights ?? {}) }, preset: p.id };
              saveMatchOptions(next);
              setMatch(next);
            }}
          >
            {MATCH_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            {match.preset === "custom" && <option value="custom">{t("filum.finestre.custom")}</option>}
          </select>
        </Row>
      </Section>
      <Section title={t("filum.finestre.my_threads")} hint={t("filum.finestre.the_spools_you_own_fit")}>
        <Row label={t("filum.finestre.spools")}>
          <span className="dz-inline">
            <b>{mine.length}</b>
            <button className="btn sm" onClick={() => useStore.getState().setDialog("threads")}>
              {t("filum.finestre.thread_colours")}
            </button>
          </span>
        </Row>
      </Section>
    </>
  );
}

function DigitizerPrefs() {
  const [done, setDone] = useState(false);
  return (
    <>
      <Section title={t("filum.finestre.settings")} hint={t("filum.finestre.the_digitizer_remembers_its_settings")}>
        <button
          className="btn sm"
          disabled={done}
          onClick={() => {
            localStorage.removeItem("filum.digitize.v2");
            localStorage.removeItem("filum.digitize.pane");
            setDone(true);
          }}
        >
          {done ? t("filum.finestre.back_to_the_defaults") : t("filum.finestre.reset_digitizer_settings")}
        </button>
      </Section>
      <Section title={t("filum.finestre.on_device_ai")} hint={t("filum.finestre.bundled_with_filum_and_run")}>
        <ul className="st-list">
          <li>
            <Cpu size={13} />{t("filum.finestre.mobilesam_select_objects_in_a")}
          </li>
          <li>
            <Cpu size={13} />{t("filum.finestre.dexined_learned_edges_for_line")}
          </li>
          <li>
            <Cpu size={13} />{t("filum.finestre.informative_drawings_a_learned_line")}
          </li>
          <li>
            <Cpu size={13} />{t("filum.finestre.tesseract_text_that_becomes_lettering")}
          </li>
        </ul>
      </Section>
    </>
  );
}

function FilePrefs() {
  const prefs = useStore((s) => s.prefs);
  const [cleared, setCleared] = useState(false);
  return (
    <>
      <Section title={t("filum.finestre.autosave")} hint={t("filum.finestre.keeps_the_design_in_this")}>
        <Row label={t("filum.finestre.autosave")}>
          <Toggle on={prefs.autosave} onChange={(v) => useStore.getState().setPrefs({ autosave: v })} />
        </Row>
        <button
          className="btn sm"
          disabled={cleared}
          onClick={() => {
            localStorage.removeItem("filum.autosave");
            setCleared(true);
          }}
        >
          {cleared ? t("filum.finestre.autosave_cleared") : t("filum.finestre.clear_the_autosaved_design")}
        </button>
      </Section>
      <Section title={t("filum.finestre.reset")} hint={t("filum.finestre.look_hints_snapping_and_arrow")}>
        <button className="btn sm" onClick={() => useStore.getState().setPrefs(DEFAULT_PREFS)}>
          {t("filum.finestre.reset_preferences")}
        </button>
      </Section>
    </>
  );
}

function KeyPrefs() {
  const p = useStore((s) => s.prefs);
  const s = useStore.getState();
  return (
    <Section title={t("filum.finestre.shortcuts")} hint={t("filum.finestre.ctrl_k_finds_any_command")}>
      <Row label={t("filum.finestre.shortcut_hints")} title={t("filum.finestre.the_bar_along_the_bottom")}>
        <Toggle on={p.hints} onChange={(v) => s.setPrefs({ hints: v })} />
      </Row>
      <span className="dz-inline">
        <button className="btn sm" onClick={() => s.setDialog("shortcuts")}>
          {t("filum.finestre.all_keyboard_shortcuts")}
        </button>
        <button className="btn sm ghost" onClick={() => s.setDialog("palette")}>
          {t("filum.finestre.command_palette")}
        </button>
      </span>
    </Section>
  );
}
