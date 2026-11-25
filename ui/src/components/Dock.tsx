import { t, tn, tx } from "../nova/i18n/filum";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Info, OctagonAlert, Shapes, TriangleAlert, type LucideIcon, ChevronUp, Eye, EyeOff, GripVertical, ImagePlus, Lock, Move, Sparkles, Trash2, Type, Unlock, Search, X, FolderTree } from "lucide-react";
import { HiddenStitchingSection, ObjectHiddenSection } from "./HiddenStitching";
import { DensityMap, Hoop, StitchFill, StitchRunning, StitchSatin } from "../icons/stitch";
import { CommandsSection } from "./CommandsSection";
import { MachineSettings } from "./MachineSettings";
import { FabricLookRows } from "./FabricLook";
import { autoFillHint, autoSatinHint } from "../lib/underlay";
import { GuideActions } from "./SatinGuides";
import { openKnockdown } from "./KnockdownDialog";
import { MulticolorSatin } from "./MulticolorSatin";
import { cleanupCandidates, cleanupDocument, DEFAULT_CLEANUP } from "../lib/shapeCheck";
import { fabricInfo } from "../lib/materials";
import { addReference, moveReference, removeReference, updateReference } from "../lib/references";
import { openFile } from "../lib/platform";
import { TextProperties, useSelectedTextGroup } from "./Lettering";
import { Presets, StitchDefaults, StitchPreview, StylePicker } from "./StitchPanel";
import { TransformPanel } from "./TransformPanel";
import { MeanderPicker } from "./MeanderPicker";
import { GradientSection } from "./GradientPanel";
import { ThreadCard, ThreadPicker } from "./ThreadPicker";
import { setObjectsThread } from "../lib/textSettle";
import { computeIssues, type Issue } from "../lib/issues";
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useShallow } from "zustand/react/shallow";
import { buildLayerRows, dropOnRow, groupInfo, moveBlock, pruneGroups, type GroupLayerRow as GroupRow, type LayerListRow, type ObjectLayerRow as ObjectRow } from "../lib/layerRows";
import { liveGroups, within } from "../lib/groups";
import { filterRows, groupByKind, groupByThread, groupTargets, KIND_FILTERS, moveToGroup, rangeIds, solo, ungroupAll, type KindFilter } from "../lib/layerTools";
import { groupSelection, selectSimilar, ungroupSelection } from "../lib/arrange";
import { Menu } from "./MenuBar";
import type { MenuItem } from "./menuModel";
import {
  defaultDesignOptions,
  defaultGuide,
  nodeCount,
  normAngle,
  objectBounds,
  pathsToPath2D,
  satinOutline,
} from "../lib/geometry";
import { useStore, type StitchPatch } from "../store";
import type { DesignObject, DesignOptions } from "../types";
import { HoopOptions, hoopValue, pickHoopOption } from "./Bars";
import { chooseHoop } from "../nova/core/hoopChoice";
import { HoopShapeRow, MaterialSection } from "./MaterialPanel";
import { Num, PatternInput, Row, Section, Slider, Toggle } from "./ui";
import { beansToPasses, formatPattern, parsePattern, passesToBeans } from "../lib/patterns";
import { defaultRippleGuide, guidePair, isRipple, useAsRippleGuide } from "../lib/rippleGuide";
import { clonesOf, unlinkClone } from "../lib/clones";
import { applyPatterns, patternPair } from "../lib/stitchPatterns";
import { TartanSection } from "./TartanPanel";
import { CutworkSection } from "./CutworkPanel";
import { ElementInfoSection } from "./ElementInfo";
import { differingSettings, EditTargets, settingLabel, useEditTargets } from "./editTargets";
import { stitchFieldsFor, stitchTypeOf, useStitchTypes, type FieldsPlace, type StitchSectionProps } from "../nova/core/stitchTypes";

function Thumb({ o, color }: { o: DesignObject; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = 26 * dpr;
    c.height = 26 * dpr;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    const b = objectBounds(o);
    if (!b) return;
    const s = (20 * dpr) / Math.max(b.w, b.h, 0.1);
    ctx.setTransform(s, 0, 0, s, (c.width - b.w * s) / 2 - b.x * s, (c.height - b.h * s) / 2 - b.y * s);
    if (o.stitch.type === "fill" || o.stitch.type === "none" || o.stitch.type === "applique") {
      ctx.fillStyle = color;
      ctx.fill(pathsToPath2D(o.paths), "evenodd");
    } else if (o.stitch.type === "satin") {
      const p = satinOutline(o);
      ctx.fillStyle = color;
      if (p) ctx.fill(p, "evenodd");
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6 / s * dpr;
      ctx.stroke(pathsToPath2D(o.paths));
    }
  }, [o, color]);
  return <canvas ref={ref} className="thumb" style={{ width: 26, height: 26 }} />;
}

/** How bad an issue is: a shape of its own per level (never colour alone). */
const SEVERITY: Record<Issue["level"], LucideIcon> = { error: OctagonAlert, warning: TriangleAlert, info: Info };

/** What an issue is about, by its title. */
function IssueTopic({ title }: { title: string }) {
  const Icon: LucideIcon | null =
    /hoop/i.test(title) ? Hoop
    : /satin/i.test(title) ? StitchSatin
    : /dense/i.test(title) ? DensityMap
    : /fill/i.test(title) ? StitchFill
    : /running|long stitch/i.test(title) ? StitchRunning
    : /lettering/i.test(title) ? Type
    : /shape|self-inters|open|tiny/i.test(title) ? Shapes
    : null;
  return Icon ? <Icon size={12} className="issue-topic" aria-hidden /> : null;
}

function SeverityIcon({ level }: { level: Issue["level"] }) {
  const Icon = SEVERITY[level];
  return <Icon size={14} className={`lvl-${level}`} aria-label={level} />;
}

/** What the layer rows do, by row key; one stable object, so rows only re-render when their own data changes. */
interface LayerCtl {
  select: (key: string, e: React.MouseEvent | React.KeyboardEvent) => void;
  check: (key: string, on: boolean) => void;
  dragStart: (key: string) => void;
  dragOver: (key: string) => void;
  drop: (key: string) => void;
  dragEnd: () => void;
  rename: (key: string | null) => void;
  /** Alt: show only this row (again: everything). */
  toggle: (o: DesignObject, only?: boolean) => void;
  fold: (group: string, folded: boolean) => void;
  showGroup: (key: string, only?: boolean) => void;
  /** Right-click a row: its menu. */
  menu: (key: string, e: React.MouseEvent) => void;
  lockGroup: (key: string) => void;
  renameGroup: (group: string, name: string) => void;
  stepGroup: (key: string, dir: 1 | -1) => void;
}

/** Fold or unfold groups in the Layers tab (remembered with the view settings, never undone). */
export function setGroupsFolded(groups: string[], folded: boolean) {
  const s = useStore.getState();
  const rest = s.foldedGroups.filter((g) => !groups.includes(g));
  s.set({ foldedGroups: folded ? [...rest, ...groups].slice(-500) : rest });
}

/** Panel header button: fold every group, or unfold them all when all are folded. */
export function FoldAllGroups() {
  // every group, the ones inside other groups too
  const groups = useStore(useShallow((s) => [...liveGroups(s.doc)]));
  const folded = useStore((s) => s.foldedGroups);
  if (!groups.length) return null;
  const allFolded = groups.every((g) => folded.includes(g));
  const label = allFolded ? "Expand all groups" : "Collapse all groups";
  return (
    <button className="icon-btn" title={label} aria-label={label} onClick={() => setGroupsFolded(groups, !allFolded)}>
      {allFolded ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
    </button>
  );
}

const LayerRow = memo(function LayerRow({
  o,
  rowKey,
  i,
  n,
  sel,
  color,
  drop,
  renaming,
  depth,
  ctl,
}: {
  o: DesignObject;
  rowKey: string;
  i: number;
  n: number;
  sel: boolean;
  color: string;
  drop: "above" | "below" | null;
  renaming: boolean;
  /** How many groups it is in (its indent). */
  depth: number;
  ctl: LayerCtl;
}) {
  const s = useStore.getState;
  return (
    <div
      className={`layer ${depth ? "member" : ""} ${sel ? "sel" : ""} ${o.visible ? "" : "hidden-obj"} ${drop ? `drop-${drop}` : ""}`}
      style={depth ? ({ "--depth": depth } as CSSProperties) : undefined}
      onContextMenu={(e) => ctl.menu(rowKey, e)}
      onClick={(e) => ctl.select(rowKey, e)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        ctl.dragStart(rowKey);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        ctl.dragOver(rowKey);
      }}
      onDrop={(e) => {
        e.preventDefault();
        ctl.drop(rowKey);
      }}
      onDragEnd={() => ctl.dragEnd()}
    >
      <GripVertical size={12} className="grip" />
      <input type="checkbox" checked={sel} onClick={(e) => e.stopPropagation()} onChange={(e) => ctl.check(rowKey, e.target.checked)} aria-label={t("filum.pannelli.select_name", { name: o.name })} />
      <span className="idx">{i + 1}</span>
      <Thumb o={o} color={color} />
      <span
        className="lname"
        onDoubleClick={() => (o.text ? s().set({ editingText: o.text.group }) : ctl.rename(rowKey))}
        title={o.text ? t("filum.pannelli.lettering_double_click_to_edit") : o.name}
      >
        {o.text ? (
          <>
            <Type size={11} style={{ verticalAlign: -1, marginRight: 4, opacity: 0.7 }} />
            {o.text.content.split("\n")[0]}
          </>
        ) : renaming ? (
          <input
            autoFocus
            defaultValue={o.name}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              s().updateObject(o.id, { name: e.target.value || o.name });
              ctl.rename(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") ctl.rename(null);
            }}
          />
        ) : (
          o.name
        )}
      </span>
      <button
        className="mini"
        title={o.visible ? t("filum.pannelli.hide_name_alt_click", { name: o.name }) : t("filum.pannelli.show_name_alt_click", { name: o.name })}
        onClick={(e) => {
          e.stopPropagation();
          ctl.toggle(o, e.altKey);
        }}
      >
        {o.visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
      <button className="mini" title={t("filum.pannelli.move_name_later_in_stitch", { name: o.name })} onClick={(e) => (e.stopPropagation(), s().moveInOrder(o.id, 1))} disabled={i === n - 1}>
        <ChevronUp size={14} />
      </button>
      <button className="mini" title={t("filum.pannelli.move_name_earlier_in_stitch", { name: o.name })} onClick={(e) => (e.stopPropagation(), s().moveInOrder(o.id, -1))} disabled={i === 0}>
        <ChevronDown size={14} />
      </button>
    </div>
  );
});

const ROLE_LABEL: Record<GroupRow["role"], string> = { get group() { return t("filum.pannelli.group"); }, get gradient() { return t("filum.pannelli.role_gradient"); }, get tartan() { return t("filum.pannelli.role_tartan"); } };

/** A group's header row: fold, select, show / hide and lock its members together, rename it. */
const GroupHeader = memo(function GroupHeader({
  r,
  sel,
  colors,
  drop,
  renaming,
  first,
  last,
  ctl,
}: {
  r: GroupRow;
  sel: "all" | "some" | "none";
  colors: string[];
  drop: "above" | "below" | null;
  renaming: boolean;
  first: boolean;
  last: boolean;
  ctl: LayerCtl;
}) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current) box.current.indeterminate = sel === "some";
  }, [sel]);
  const shown = colors.slice(0, 5);
  const what = `${ROLE_LABEL[r.role].toLowerCase()} ${r.name}`;
  return (
    <div
      className={`layer group-head ${r.depth ? "member" : ""} ${sel === "all" ? "sel" : sel === "some" ? "part" : ""} ${r.visible === "none" ? "hidden-obj" : ""} ${drop ? `drop-${drop}` : ""}`}
      style={r.depth ? ({ "--depth": r.depth } as CSSProperties) : undefined}
      onContextMenu={(e) => ctl.menu(r.key, e)}
      tabIndex={0}
      aria-label={t("filum.pannelli.group_row_aria", { role: ROLE_LABEL[r.role], name: r.name, objects: tn("filum.pannelli.n_objects", r.count), state: r.folded ? t("filum.pannelli.folded") : t("filum.pannelli.unfolded") })}
      onClick={(e) => ctl.select(r.key, e)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget && (e.target as HTMLElement).tagName === "INPUT") return;
        const k = e.key;
        if ((k === "ArrowLeft" && !r.folded) || (k === "ArrowRight" && r.folded)) ctl.fold(r.group, k === "ArrowLeft");
        else if (k === "Enter" && e.target === e.currentTarget) ctl.select(r.key, e);
        else if (k === "F2") ctl.rename(r.key);
        else if (k !== "ArrowLeft" && k !== "ArrowRight") return;
        e.preventDefault();
        e.stopPropagation();
      }}
      draggable={!renaming}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        ctl.dragStart(r.key);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        ctl.dragOver(r.key);
      }}
      onDrop={(e) => {
        e.preventDefault();
        ctl.drop(r.key);
      }}
      onDragEnd={() => ctl.dragEnd()}
    >
      <GripVertical size={12} className="grip" />
      <input ref={box} type="checkbox" checked={sel === "all"} onClick={(e) => e.stopPropagation()} onChange={(e) => ctl.check(r.key, e.target.checked)} aria-label={t("filum.pannelli.select_the_what", { what })} />
      <button
        className={`mini fold ${r.folded ? "" : "open"}`}
        aria-expanded={!r.folded}
        aria-label={r.folded ? t("filum.pannelli.unfold_the_what", { what }) : t("filum.pannelli.fold_the_what", { what })}
        title={`${r.folded ? t("filum.pannelli.unfold") : t("filum.pannelli.fold")} (← →)`}
        onClick={(e) => {
          e.stopPropagation();
          ctl.fold(r.group, !r.folded);
        }}
      >
        <ChevronRight size={14} />
      </button>
      <span className="lname" onDoubleClick={() => ctl.rename(r.key)} title={t("filum.pannelli.name_v2_of_count_double", { name: r.name, v2: ROLE_LABEL[r.role].toLowerCase(), count: r.count })}>
        {renaming ? (
          <input
            autoFocus
            defaultValue={r.name}
            aria-label={t("filum.pannelli.name_of_the_what", { what })}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              ctl.renameGroup(r.group, e.target.value.trim());
              ctl.rename(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") ctl.rename(null);
            }}
          />
        ) : (
          <>
            {r.name}
            <span className="grp-n">{r.count}</span>
          </>
        )}
      </span>
      <span className="grp-sw" role="img" aria-label={tn("filum.pannelli.n_threads", colors.length)}>
        {shown.map((c, k) => (
          <i key={k} style={{ background: c }} />
        ))}
        {colors.length > shown.length && <em>+{colors.length - shown.length}</em>}
      </span>
      <button
        className={`mini ${r.locked === "some" ? "mixed" : ""}`}
        title={r.locked === "all" ? t("filum.pannelli.unlock_everything_in_name", { name: r.name }) : t("filum.pannelli.lock_everything_in_name", { name: r.name })}
        aria-label={r.locked === "all" ? t("filum.pannelli.unlock_the_what", { what }) : t("filum.pannelli.lock_the_what", { what })}
        aria-pressed={r.locked === "all" ? true : r.locked === "some" ? "mixed" : false}
        onClick={(e) => {
          e.stopPropagation();
          ctl.lockGroup(r.key);
        }}
      >
        {r.locked === "none" ? <Unlock size={13} /> : <Lock size={13} />}
      </button>
      <button
        className={`mini ${r.visible === "some" ? "mixed" : ""}`}
        title={r.visible === "all" ? t("filum.pannelli.hide_everything_in_name_alt_click", { name: r.name }) : t("filum.pannelli.show_everything_in_name_alt_click", { name: r.name })}
        aria-label={r.visible === "all" ? t("filum.pannelli.hide_the_what", { what }) : t("filum.pannelli.show_the_what", { what })}
        onClick={(e) => {
          e.stopPropagation();
          ctl.showGroup(r.key, e.altKey);
        }}
      >
        {r.visible === "none" ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      <button className="mini" title={t("filum.pannelli.move_name_later_in_stitch", { name: r.name })} onClick={(e) => (e.stopPropagation(), ctl.stepGroup(r.key, 1))} disabled={first}>
        <ChevronUp size={14} />
      </button>
      <button className="mini" title={t("filum.pannelli.move_name_earlier_in_stitch", { name: r.name })} onClick={(e) => (e.stopPropagation(), ctl.stepGroup(r.key, -1))} disabled={last}>
        <ChevronDown size={14} />
      </button>
    </div>
  );
});

export function LayersPanel() {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const foldedGroups = useStore((s) => s.foldedGroups);
  const s = useStore.getState;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ key: string; over: string | null; at: "above" | "below" } | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  /** Where a Shift-click range starts: the row clicked last. */
  const anchor = useRef<string | null>(null);
  const filtering = !!query.trim() || kind !== "all";
  const colors = new Map(doc.threads.map((t) => [t.id, t.color]));
  const n = doc.objects.length;
  const selected = new Set(selection);
  // top of the list = stitched last (sits on top); a lettering shows as one row, a group as a foldable header
  // while filtering, the groups open so what matches shows
  const allRows = useMemo(
    () => buildLayerRows(doc.objects, new Set(filtering ? [] : foldedGroups), doc.groupNames, doc.groupParents),
    [doc.objects, foldedGroups, doc.groupNames, doc.groupParents, filtering],
  );
  const rows = useMemo(() => filterRows(allRows, doc, query, kind), [allRows, doc, query, kind]);
  // the handlers read the current state through a ref: one stable object for every row
  const cur = useRef({ drag, setDrag, setRenaming, rows, setMenu });
  cur.current = { drag, setDrag, setRenaming, rows, setMenu };
  const ctl = useRef<LayerCtl | null>(null);
  if (!ctl.current) {
    const row = (key: string) => cur.current.rows.find((r) => r.key === key);
    const setAll = (ids: string[], patch: (o: DesignObject) => Partial<DesignObject>) => {
      const set = new Set(ids);
      s().commit((d) => ({ ...d, objects: d.objects.map((x) => (set.has(x.id) ? { ...x, ...patch(x) } : x)) }));
    };
    ctl.current = {
      select: (key, e) => {
        const r = row(key);
        if (!r) return;
        const sel = s().selection;
        const ids = r.ids;
        const on = r.kind === "group" ? ids.every((id) => sel.includes(id)) : sel.includes(r.o.id);
        // the row clicked last may be filtered out or folded away: then this is a plain click
        if (e.shiftKey && anchor.current && anchor.current !== key && row(anchor.current)) {
          // Shift: the rows from the one clicked last to this one (Ctrl+Shift adds them)
          const range = rangeIds(cur.current.rows, anchor.current, key);
          s().select(e.metaKey || e.ctrlKey ? [...new Set([...sel, ...range])] : range);
          return;
        }
        anchor.current = key;
        if (e.shiftKey || e.metaKey || e.ctrlKey) s().select(on ? sel.filter((x) => !ids.includes(x)) : [...sel.filter((x) => !ids.includes(x)), ...ids]);
        else s().select(ids);
        if (r.kind === "object") s().set({ activeThread: r.o.thread });
      },
      check: (key, on) => {
        const ids = row(key)?.ids ?? [];
        const sel = s().selection;
        s().select(on ? [...sel.filter((x) => !ids.includes(x)), ...ids] : sel.filter((x) => !ids.includes(x)));
      },
      dragStart: (key) => cur.current.setDrag({ key, over: null, at: "above" }),
      dragOver: (key) => {
        const { drag: d, rows: rs } = cur.current;
        if (!d) return;
        const from = rs.findIndex((r) => r.key === d.key);
        const to = rs.findIndex((r) => r.key === key);
        const t = rs[to];
        // a group over anything inside it goes nowhere
        const g = rs[from]?.kind === "group" ? (rs[from] as GroupRow).group : null;
        const doc = s().doc;
        const none = key === d.key || (!!g && !!t && (t.kind === "object" ? !!t.member && within(doc, t.member, g) : within(doc, t.group, g)));
        const over = none ? null : key;
        const at = to < from || (t?.kind === "group" && t.group === (rs[from] as ObjectRow | undefined)?.member) ? "above" : "below";
        if (d.over !== over || d.at !== at) cur.current.setDrag({ ...d, over, at });
      },
      drop: (key) => {
        const d = cur.current.drag;
        cur.current.setDrag(null);
        const from = d && row(d.key);
        const to = row(key);
        if (!from || !to) return;
        if (dropOnRow(s().doc, from, to) === s().doc) return;
        s().commit((doc) => pruneGroups(dropOnRow(doc, from, to)));
      },
      dragEnd: () => cur.current.setDrag(null),
      rename: (key) => cur.current.setRenaming(key),
      toggle: (o, only) => {
        const ids = o.text ? s().doc.objects.filter((x) => x.text?.group === o.text!.group).map((x) => x.id) : [o.id];
        if (only) s().commit((d) => solo(d, ids));
        else setAll(ids, () => ({ visible: !o.visible }));
      },
      fold: (group, folded) => setGroupsFolded([group], folded),
      showGroup: (key, only) => {
        const r = row(key);
        if (r?.kind !== "group") return;
        if (only) s().commit((d) => solo(d, r.ids));
        else setAll(r.ids, () => ({ visible: r.visible !== "all" }));
      },
      menu: (key, e) => {
        const r = row(key);
        if (!r) return;
        e.preventDefault();
        // the row's objects become the selection unless they are in it already
        const sel = s().selection;
        if (!r.ids.every((id) => sel.includes(id))) s().select(r.ids);
        const ids = s().selection;
        const doc = s().doc;
        const objs = doc.objects.filter((o) => ids.includes(o.id));
        const into = (g: string | undefined) => () => s().commit((d) => moveToGroup(d, s().selection, g));
        const targets = groupTargets(doc).filter(([g]) => !objs.every((o) => o.group === g) && !(r.kind === "group" && within(doc, g, r.group)));
        const items: MenuItem[] = [
          ...(r.kind === "group"
            ? ([
                { label: t("filum.pannelli.rename"), run: () => cur.current.setRenaming(key) },
                { label: r.folded ? t("filum.pannelli.unfold") : t("filum.pannelli.fold"), run: () => setGroupsFolded([r.group], !r.folded) },
                "-",
              ] as MenuItem[])
            : []),
          { label: t("filum.pannelli.group"), kbd: "Ctrl+G", run: groupSelection, disabled: ids.length < 2 && r.kind !== "group" },
          { label: t("filum.pannelli.ungroup"), kbd: "Ctrl+⇧G", run: ungroupSelection, disabled: !objs.some((o) => o.group) },
          {
            label: t("filum.pannelli.move_to_group"),
            disabled: !targets.length && !objs.some((o) => o.group),
            sub: [
              ...targets.map(([g, name]): MenuItem => ({ label: name, run: into(g) })),
              ...(targets.length ? (["-"] as MenuItem[]) : []),
              { label: t("filum.pannelli.out_of_every_group"), run: into(undefined), disabled: !objs.some((o) => o.group) },
            ],
          },
          "-",
          {
            label: t("filum.pannelli.select_same"),
            sub: [
              { label: t("filum.pannelli.colour"), run: () => selectSimilar("color") },
              { label: t("filum.pannelli.stitch_type"), run: () => selectSimilar("type") },
            ],
          },
          "-",
          { label: t("filum.pannelli.show_only_this"), run: () => s().commit((d) => solo(d, ids)), hint: t("filum.pannelli.alt_click_an_eye_does") },
          { label: t("filum.pannelli.show_all"), run: () => setAll(s().doc.objects.map((o) => o.id), () => ({ visible: true })), disabled: doc.objects.every((o) => o.visible) },
          { label: objs.every((o) => o.locked) ? t("filum.pannelli.unlock") : t("filum.pannelli.lock"), run: () => setAll(ids, () => ({ locked: !objs.every((o) => o.locked) })) },
          "-",
          { label: t("filum.pannelli.delete"), kbd: "Del", run: () => s().deleteSelection() },
        ];
        cur.current.setMenu({ x: e.clientX, y: e.clientY, items });
      },
      lockGroup: (key) => {
        const r = row(key);
        if (r?.kind === "group") setAll(r.ids, () => ({ locked: r.locked !== "all" }));
      },
      renameGroup: (group, name) => {
        const names = s().doc.groupNames ?? {};
        if ((names[group] ?? "") === name) return;
        const auto = !name || name === groupInfo(s().doc.objects, { ...names, [group]: "" }, s().doc.groupParents).get(group)?.name;
        s().commit((d) => {
          const { [group]: _, ...rest } = d.groupNames ?? {};
          const next = auto ? rest : { ...rest, [group]: name };
          return { ...d, groupNames: Object.keys(next).length ? next : undefined };
        });
      },
      stepGroup: (key, dir) => {
        const ts = siblings(cur.current.rows, key);
        const k = ts.findIndex((r) => r.key === key);
        const r = ts[k];
        const next = ts[k - dir];
        if (!r || !next) return;
        s().commit((d) => ({ ...d, objects: moveBlock(d.objects, r.ids, next.ids, dir > 0 ? "above" : "below") }));
      },
    };
  }
  if (!n)
    return (
      <>
        <div className="hint" style={{ padding: 14 }}>{t("filum.pannelli.no_objects_yet_draw_with")}</div>
        <ReferencesList />
      </>
    );
  const dropOf = (key: string) => (drag?.over === key ? drag.at : null);
  const organise = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const run = (f: (d: typeof doc) => { doc: typeof doc; made: number }, what: string) => () => {
      const out = f(s().doc);
      if (!out.made) return s().toast(t("filum.pannelli.nothing_to_group_no_two", { what }));
      s().commit(() => out.doc);
      s().toast(t("filum.pannelli.groups_by_what", { groups: tn("filum.pannelli.n_groups", out.made), what }), "success");
    };
    const groups = [...liveGroups(doc)];
    setMenu({
      x: r.left,
      y: r.bottom + 2,
      items: [
        { label: t("filum.pannelli.group_loose_objects_by_thread"), run: run(groupByThread, t("filum.pannelli.what_thread")), hint: t("filum.pannelli.one_group_per_thread_colour") },
        { label: t("filum.pannelli.group_loose_objects_by_stitch"), run: run(groupByKind, t("filum.pannelli.what_stitch_type")), hint: t("filum.pannelli.fills_satins_lines_and_lettering") },
        { label: t("filum.pannelli.ungroup_all"), run: () => s().commit((d) => ungroupAll(d)), disabled: !groups.length },
        "-",
        { label: t("filum.pannelli.fold_all_groups"), run: () => setGroupsFolded(groups, true), disabled: !groups.length },
        { label: t("filum.pannelli.unfold_all_groups"), run: () => setGroupsFolded(groups, false), disabled: !groups.length },
        "-",
        { label: t("filum.pannelli.select_what_s_listed"), run: () => s().select([...new Set(rows.flatMap((x) => x.ids))]), hint: t("filum.pannelli.every_object_the_filter_shows") },
        { label: t("filum.pannelli.show_all"), run: () => s().commit((d) => ({ ...d, objects: d.objects.map((o) => (o.visible ? o : { ...o, visible: true })) })), disabled: doc.objects.every((o) => o.visible) },
        { label: t("filum.pannelli.unlock_all"), run: () => s().commit((d) => ({ ...d, objects: d.objects.map((o) => (o.locked ? { ...o, locked: false } : o)) })), disabled: !doc.objects.some((o) => o.locked) },
      ],
    });
  };
  return (
    <div onDragOver={(e) => e.preventDefault()}>
      <div className="layers-tools">
        <label className="layers-search">
          <Search size={13} aria-hidden="true" />
          <input
            type="search"
            placeholder={t("filum.pannelli.find_layers")}
            aria-label={t("filum.pannelli.find_layers_by_name_or")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
          />
          {query && (
            <button className="mini" aria-label={t("filum.pannelli.clear_the_search")} onClick={() => setQuery("")}>
              <X size={12} />
            </button>
          )}
        </label>
        <select className="select" value={kind} aria-label={t("filum.pannelli.show_stitch_type")} onChange={(e) => setKind(e.target.value as KindFilter)}>
          {KIND_FILTERS().map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <button className="icon-btn" title={t("filum.pannelli.organise_group_by_thread_or")} aria-label={t("filum.pannelli.organise_layers")} onClick={organise}>
          <FolderTree size={14} />
        </button>
      </div>
      {filtering && (
        <div className="layers-filtered">
          {t("filum.pannelli.n_of_total_rows", { n: rows.filter((x) => x.kind === "object").length, total: allRows.filter((x) => x.kind === "object").length })}
          <button className="btn sm ghost" onClick={() => (setQuery(""), setKind("all"))}>
            {t("filum.pannelli.clear")}
          </button>
        </div>
      )}
      {menu && <Menu items={menu.items} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
      {rows.map((r) =>
        r.kind === "group" ? (
          <GroupHeader
            key={r.key}
            r={r}
            sel={tri(r.ids.filter((id) => selected.has(id)).length, r.ids.length)}
            colors={r.threads.map((t) => colors.get(t) ?? "#222")}
            drop={dropOf(r.key)}
            renaming={renaming === r.key}
            first={siblings(rows, r.key)[0] === r}
            last={siblings(rows, r.key).at(-1) === r}
            ctl={ctl.current!}
          />
        ) : (
          <LayerRow
            key={r.key}
            o={r.o}
            rowKey={r.key}
            i={r.i}
            n={n}
            sel={selected.has(r.o.id)}
            color={colors.get(r.o.thread) ?? "#222"}
            drop={dropOf(r.key)}
            renaming={renaming === r.key}
            depth={r.depth}
            ctl={ctl.current!}
          />
        ),
      )}
      <ReferencesList />
    </div>
  );
}

const tri = (k: number, n: number) => (k === n ? "all" : k ? "some" : "none");

/** The group a row sits in (none at the top level). */
const containerOf = (r: LayerListRow) => (r.kind === "group" ? r.parent : r.member);

/** The rows next to `key` in the same group, top first. */
function siblings(rows: LayerListRow[], key: string): LayerListRow[] {
  const r = rows.find((x) => x.key === key);
  if (!r) return [];
  const c = containerOf(r);
  return rows.filter((x) => containerOf(x) === c);
}

/** Reference pictures: under the stitch layers (they are never stitched). */
function ReferencesList() {
  const refs = useStore((s) => s.doc.references) ?? [];
  const refEdit = useStore((s) => s.refEdit);
  const add = async () => {
    const f = await openFile([{ name: t("filum.pannelli.pictures"), extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"] }]);
    if (f) await addReference(f.name, f.bytes);
  };
  return (
    <div className="refs">
      <div className="refs-head">
        <span>{t("filum.pannelli.references")}</span>
        <button className="mini" title={t("filum.pannelli.add_a_picture_to_trace")} onClick={add}>
          <ImagePlus size={14} />
        </button>
      </div>
      {!refs.length && <div className="hint refs-empty">{t("filum.pannelli.drop_or_paste_a_picture")}</div>}
      {[...refs].reverse().map((r) => (
        <div
          key={r.id}
          className={`layer ref-row ${refEdit === r.id ? "sel" : ""} ${r.visible ? "" : "hidden-obj"}`}
          onDoubleClick={() => !r.locked && useStore.getState().set({ refEdit: r.id })}
          title={r.locked ? r.name : t("filum.pannelli.name_double_click_to_adjust", { name: r.name })}
        >
          <img className="thumb ref-thumb" src={r.src} alt="" />
          <span className="lname">{r.name}</span>
          <span className="stat">{Math.round(r.opacity * 100)}%</span>
          <button
            className="mini"
            title={r.locked ? t("filum.pannelli.locked") : t("filum.pannelli.adjust_on_the_canvas")}
            disabled={r.locked}
            onClick={() => useStore.getState().set({ refEdit: refEdit === r.id ? null : r.id })}
          >
            <Move size={13} />
          </button>
          <button className="mini" title={r.locked ? t("filum.pannelli.unlock") : t("filum.pannelli.lock")} onClick={() => updateReference(r.id, { locked: !r.locked })}>
            {r.locked ? <Lock size={13} /> : <Unlock size={13} />}
          </button>
          <button className="mini" title={r.visible ? t("filum.pannelli.hide") : t("filum.pannelli.show")} onClick={() => updateReference(r.id, { visible: !r.visible })}>
            {r.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button className="mini" title={t("filum.pannelli.up_drawn_later")} onClick={() => moveReference(r.id, 1)}>
            <ChevronUp size={14} />
          </button>
          <button className="mini" title={t("filum.pannelli.down_drawn_earlier")} onClick={() => moveReference(r.id, -1)}>
            <ChevronDown size={14} />
          </button>
          <button className="mini" title={t("filum.pannelli.remove")} onClick={() => removeReference(r.id)}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ScenePanel() {
  const doc = useStore((s) => s.doc);
  const commit = useStore((s) => s.commit);
  return (
    <div className="props">
      <Section title={t("filum.pannelli.hoop")}>
        <Row label={t("filum.pannelli.preset")}>
          <select
            className="select"
            style={{ width: "100%" }}
            value={hoopValue(doc.hoop, doc.nova?.hoopRef)}
            onChange={(e) => pickHoopOption(e.target.value)}
          >
            <option value={-1}>{t("filum.pannelli.custom")}</option>
            <HoopOptions />
          </select>
        </Row>
        <div className="grid2">
          <div className="row">
            <label>W</label>
            <Num value={doc.hoop.width} unit="mm" step={5} min={20} onChange={(v) => chooseHoop({ source: "custom", hoop: { ...doc.hoop, width: v, name: t("filum.pannelli.custom") } }, () => commit((d) => ({ ...d, hoop: { ...d.hoop, width: v, name: t("filum.pannelli.custom") } })))} />
          </div>
          <div className="row">
            <label>H</label>
            <Num value={doc.hoop.height} unit="mm" step={5} min={20} onChange={(v) => chooseHoop({ source: "custom", hoop: { ...doc.hoop, height: v, name: t("filum.pannelli.custom") } }, () => commit((d) => ({ ...d, hoop: { ...d.hoop, height: v, name: t("filum.pannelli.custom") } })))} />
          </div>
        </div>
        <HoopShapeRow />
      </Section>
      <Section title={t("filum.pannelli.fabric_thread")}>
        <MaterialSection />
      </Section>
      <HiddenStitchingSection />
      <DesignOptionsSection />
      <MachineSettings />
      <Section title={t("filum.pannelli.fabric_look")} defaultOpen={false}>
        <FabricLookRows />
      </Section>
    </div>
  );
}

/** Design-wide stitch processing (applied when the plan is built, objects stay as drawn). */
function DesignOptionsSection() {
  const doc = useStore((s) => s.doc);
  const o = doc.options ?? defaultDesignOptions();
  const set = (p: Partial<DesignOptions>) => useStore.getState().commit((d) => ({ ...d, options: { ...(d.options ?? defaultDesignOptions()), ...p } }));
  return (
    <Section title={t("filum.pannelli.stitch_processing")}>
      <Row label={t("filum.pannelli.basting")} title={t("filum.pannelli.long_stitches_sewn_first_to")}>
        <select className="select" style={{ width: "100%" }} value={o.basting} onChange={(e) => set({ basting: e.target.value as DesignOptions["basting"] })}>
          <option value="none">{t("filum.pannelli.none")}</option>
          <option value="box">{t("filum.pannelli.box_around_the_design")}</option>
          <option value="contour">{t("filum.pannelli.following_the_design")}</option>
        </select>
      </Row>
      {o.basting !== "none" && (
        <>
          <Row label={t("filum.pannelli.distance")}>
            <Num value={o.bastingMargin} unit="mm" step={1} min={0} max={40} onChange={(v) => set({ bastingMargin: v })} />
          </Row>
          <Row label={t("filum.pannelli.stitch_length")}>
            <Num value={o.bastingLength} unit="mm" step={0.5} min={2} max={10} onChange={(v) => set({ bastingLength: v })} />
          </Row>
        </>
      )}
      <KnockdownRow o={o} set={set} />
    </Section>
  );
}

/** What auto underlay does on the design's fabric. */
function AutoUnderlayHint({ kind }: { kind: "fill" | "satin" }) {
  const fabric = useStore((s) => s.doc.fabric);
  const knockdown = useStore((s) => !!s.doc.options?.knockdown);
  const label = fabricInfo(fabric).label;
  return (
    <p className="hint ul-auto">
      <Sparkles size={11} /> <b>{t("filum.pannelli.auto_on_label", { label })}</b> {kind === "fill" ? autoFillHint(fabric, knockdown) : autoSatinHint(fabric, knockdown)}
    </p>
  );
}

/** Knockdown in Design ▸ Stitch processing: on/off and what it is; the settings are in the knockdown dialog. */
function KnockdownRow({ o, set }: { o: DesignOptions; set: (p: Partial<DesignOptions>) => void }) {
  const fabricColor = useStore((s) => s.fabricColor);
  const on = !!o.knockdown;
  return (
    <Row label="Knockdown" title={t("filum.pannelli.a_light_net_sewn_first")}>
      <span className="dz-inline">
        <Toggle on={on} onChange={(v) => set(v ? { knockdown: true, knockdownColor: o.knockdownColor || fabricColor } : { knockdown: false })} />
        {on && (
          <span className="stat">
            {(o.knockdownLayers ?? 2) === 2 ? t("filum.pannelli.crossed") : t("filum.pannelli.single")} · {o.knockdownSpacing ?? 2} mm
          </span>
        )}
        <button className="btn sm ghost" title={t("filum.pannelli.knockdown_settings_for_the_whole")} onClick={() => openKnockdown("design")}>
          {t("filum.pannelli.edit")}
        </button>
      </span>
    </Row>
  );
}

/**
 * Contour / spiral direction, clockwise on screen (the engine's
 * `contourClockwise`, default true as in Ink/Stitch). Designs saved before
 * it stored `clockwise` with the opposite meaning (true = counter-clockwise);
 * the engine reads that flipped, and so does this.
 */
function contourClockwise(st: { contourClockwise?: boolean; clockwise?: boolean }): boolean {
  return st.contourClockwise ?? (st.clockwise === undefined ? true : !st.clockwise);
}

function StitchOptions({ o }: { o: DesignObject }) {
  const st = o.stitch;
  // one object, or every selected object of this stitch type (multi-selection)
  const targets = useEditTargets(o);
  const many = targets.length > 1;
  const up = (p: StitchPatch) => useStore.getState().updateStitch(targets, p);
  const live = (p: StitchPatch) => useStore.getState().updateStitch(targets, p, true);
  const begin = () => useStore.getState().checkpoint();
  // sliders: preview live while dragging, one undo step
  const sl = (key: string) => ({
    onChange: (v: number) => up({ [key]: v } as StitchPatch),
    onLive: (v: number) => {
      if (!(window as unknown as { __sl?: boolean }).__sl) {
        begin();
        (window as unknown as { __sl?: boolean }).__sl = true;
        setTimeout(() => ((window as unknown as { __sl?: boolean }).__sl = false), 400);
      }
      live({ [key]: v } as StitchPatch);
    },
  });
  // NOVAstitch: a stitch of a module's type shows the module's section instead of Filum's (nova/core/stitchTypes.ts)
  useStitchTypes();
  const own = stitchTypeOf(st);
  const nova: StitchSectionProps = { o, targets, up, live, begin };
  const novaFields = (place: FieldsPlace) =>
    stitchFieldsFor(st.type, place).map((f) => (
      <div key={f.id} data-nova={f.module}>
        <f.Fields {...nova} />
      </div>
    ));
  if (own)
    return (
      <>
        <StylePicker o={o} />
        <StitchPreview o={o} />
        <StitchDefaults o={o} />
        <div data-nova={own.module}>
          <own.Section {...nova} />
        </div>
      </>
    );
  return (
    <>
      <StylePicker o={o} />
      {st.type !== "none" && <StitchPreview o={o} />}
      <StitchDefaults o={o} />
      {st.type === "fill" && st.gradient && !many && <GradientSection group={st.gradient.group} />}
      {st.type === "fill" && !st.gradient && (
        <>
          {st.method === "tatami" && (
            <Row label={t("filum.pannelli.density")}>
              <Presets
                items={[
                  [t("filum.pannelli.light"), 0.4, t("filum.pannelli.rows_040_soft")],
                  [t("filum.pannelli.normal"), 0.25, t("filum.pannelli.rows_025_standard")],
                  [t("filum.pannelli.dense"), 0.2, t("filum.pannelli.n0_20_mm_rows_full")],
                ]}
                value={st.rowSpacing}
                onPick={(v) => up({ rowSpacing: v })}
              />
            </Row>
          )}
          {st.method === "meander" && (
            <>
              <Row label={t("filum.pannelli.pattern")} title={t("filum.pannelli.the_lattice_or_ink_stitch")}>
                <MeanderPicker
                  pattern={st.meanderPattern}
                  tile={st.meanderTile}
                  onPick={(p) => up(p.tile ? { meanderTile: p.tile } : { meanderPattern: p.pattern, meanderTile: undefined })}
                />
              </Row>
              {st.meanderTile ? (
                <Row label={t("filum.pannelli.scale")} title={t("filum.pannelli.size_of_the_tile_ink")}>
                  {(() => {
                    // 2.5 mm ≙ 100 %
                    const s = sl("meanderScale");
                    return <Slider min={25} max={400} step={5} digits={0} value={((st.meanderScale ?? 2.5) / 2.5) * 100} unit="%" onChange={(v) => s.onChange(v / 40)} onLive={(v) => s.onLive(v / 40)} />;
                  })()}
                </Row>
              ) : (
                <Row label={t("filum.pannelli.scale")} title={t("filum.pannelli.cell_size_of_the_lattice")}>
                  <Slider min={1} max={10} step={0.1} value={st.meanderScale ?? 2.5} unit="mm" {...sl("meanderScale")} />
                </Row>
              )}
              <Row label={t("filum.pannelli.height")} title={t("filum.pannelli.stretch_or_squash_the_pattern")}>
                <Slider min={25} max={400} step={5} digits={0} unit="%" value={Math.round((st.meanderAspect ?? 1) * 100)} onChange={(v) => up({ meanderAspect: v / 100 })} />
              </Row>
              <Row label={t("filum.pannelli.smoothness")} title={t("filum.pannelli.n0_sharp_corners_1_soft")}>
                <Slider min={0} max={1} step={0.05} value={st.smoothness ?? 0.5} {...sl("smoothness")} />
              </Row>
              <Row label="Zig-zag" title={t("filum.pannelli.sew_the_meander_as_a")}>
                <span className="dz-inline">
                  <Toggle on={(st.meanderZigzag ?? 0) > 0} onChange={(on) => up({ meanderZigzag: on ? 1.5 : 0 })} />
                  {(st.meanderZigzag ?? 0) > 0 && (
                    <>
                      <Num value={st.meanderZigzag ?? 1.5} step={0.1} min={0.2} max={6} unit="mm" onChange={(v) => up({ meanderZigzag: v })} />
                      <Num value={st.meanderZigzagWidth ?? 3} step={0.25} min={0.3} max={10} unit="mm" onChange={(v) => up({ meanderZigzagWidth: v })} />
                    </>
                  )}
                </span>
              </Row>
              <Row label={t("filum.pannelli.clip_to_shape")} title={t("filum.pannelli.keep_every_stitch_inside_the")}>
                <Toggle on={!!st.meanderClip} onChange={(v) => up({ meanderClip: v })} />
              </Row>
              <Row label={t("filum.pannelli.variation")}>
                <button className="btn sm" onClick={() => up({ seed: ((st.seed ?? 1) % 9973) + 1 })}>
                  {t("filum.pannelli.shuffle")}
                </button>
              </Row>
            </>
          )}
          {st.method === "guided" && (
            <>
              <p className="hint" style={{ margin: "2px 0 6px" }}>
                {t("filum.pannelli.rows_follow_the_dashed_guide")}
              </p>
              <Row label={t("filum.pannelli.rows_2")} title={t("filum.pannelli.copies_of_the_guide_shifted")}>
                <div className="seg">
                  {(
                    [
                      ["copy", t("filum.pannelli.copies")],
                      ["parallel", t("filum.pannelli.parallel")],
                      ["buffer", t("filum.pannelli.around")],
                    ] as const
                  ).map(([v, l]) => (
                    <button key={v} className={(st.guidedStrategy ?? "copy") === v ? "on" : ""} onClick={() => up({ guidedStrategy: v })}>
                      {l}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label={t("filum.pannelli.guide")}>
                <button
                  className="btn sm"
                  title={t("filum.pannelli.reset_the_guide_to_an")}
                  onClick={() => {
                    // each object's guide across its own shape
                    const ids = new Set(targets);
                    useStore.getState().commit((d) => ({
                      ...d,
                      objects: d.objects.map((x) => {
                        const b = ids.has(x.id) && x.stitch.type === "fill" ? objectBounds(x) : null;
                        return b && x.stitch.type === "fill" ? { ...x, stitch: { ...x.stitch, guide: defaultGuide(b) } } : x;
                      }),
                    }));
                  }}
                >
                  {t("filum.pannelli.reset")}
                </button>
                <span className="stat" title={t("filum.pannelli.select_the_fill_and_an")}>{t("filum.pannelli.or_draw_a_line_path")}</span>
              </Row>
            </>
          )}
          {st.method !== "hilbert" && st.method !== "stipple" && st.method !== "guided" && st.method !== "circular" && (
            <Row label={t("filum.pannelli.angle")}>
              <Slider min={-90} max={90} step={1} value={st.angle} unit="°" digits={1} {...sl("angle")} onChange={(v) => up({ angle: normAngle(v) })} />
            </Row>
          )}
          {st.method === "curved" && !st.gradient && (
            <Row label={t("filum.pannelli.follow_the_shape")} title={t("filum.pannelli.n0_straight_rows_along_the")}>
              <Slider min={0} max={100} step={5} digits={0} unit="%" value={Math.round((st.curve ?? 1) * 100)} onChange={(v) => up({ curve: v / 100 })} />
            </Row>
          )}
          {/* cross stitch: the cell sets both (see the cross section below) */}
          {st.method !== "cross" && (
            <>
              <Row label={st.method === "tatami" ? t("filum.pannelli.row_spacing") : t("filum.pannelli.spacing")}>
                <Slider min={0.15} max={st.method === "hilbert" || st.method === "stipple" ? 4 : 1.2} step={0.01} value={st.rowSpacing} unit="mm" {...sl("rowSpacing")} />
              </Row>
              <Row label={t("filum.pannelli.max_stitch")}>
                <Slider min={1} max={7} step={0.1} value={st.maxStitchLength} unit="mm" {...sl("maxStitchLength")} />
              </Row>
            </>
          )}
          {["tatami", "contour", "spiral", "guided", "circular"].includes(st.method) && !st.gradient && (
            <RandomLength value={st.randomLength ?? 0} onChange={(v) => up({ randomLength: v })} onShuffle={() => up({ seed: ((st.seed ?? 1) % 9973) + 1 })} />
          )}
          <Row label={t("filum.pannelli.travel_stitch")} title={t("filum.pannelli.length_of_the_hidden_running")}>
            <Num value={st.travelLength} step={0.5} min={1} max={6} unit="mm" onChange={(v) => up({ travelLength: v })} />
          </Row>
          {st.method === "tatami" && (
            <Row label={t("filum.pannelli.underpath")} title={t("filum.pannelli.travel_inside_the_shape_between")}>
              <Toggle on={st.underpath ?? true} onChange={(v) => up({ underpath: v })} />
            </Row>
          )}
          {st.method === "tatami" && !st.gradient && (
            <Row label={t("filum.pannelli.gap_rows")} title={t("filum.pannelli.extra_rows_sewn_past_the")}>
              <Num value={st.gapFillRows ?? 0} step={2} min={0} max={10} digits={0} unit={t("filum.pannelli.rows_3")} onChange={(v) => up({ gapFillRows: Math.ceil(Math.round(v) / 2) * 2 })} />
            </Row>
          )}
          {st.method === "cross" && (
            <Row label={t("filum.pannelli.cross_order")} title={t("filum.pannelli.which_diagonal_goes_first_all")}>
              <span className="dz-inline">
                <div className="seg">
                  <button className={!st.crossFlip ? "on" : ""} onClick={() => up({ crossFlip: false })} title={t("filum.pannelli.top_left_to_bottom_right")}>
                    {t("filum.pannelli.then")}
                  </button>
                  <button className={st.crossFlip ? "on" : ""} onClick={() => up({ crossFlip: true })} title={t("filum.pannelli.bottom_left_to_top_right")}>
                    {t("filum.pannelli.then_2")}
                  </button>
                </div>
                <Num value={st.crossThreads ?? 1} step={2} min={1} max={5} digits={0} unit="×" onChange={(v) => up({ crossThreads: Math.max(1, Math.round((v - 1) / 2) * 2 + 1) })} />
              </span>
            </Row>
          )}
          {st.method === "tatami" && (
            <>
              <Row
                label={t("filum.pannelli.sewing_order")}
                title={t("filum.pannelli.the_order_the_rows_are")}
              >
                <select
                  className="select"
                  aria-label={t("filum.pannelli.sewing_order")}
                  value={st.centerOut ? "centre" : st.tatamiRoute === "inkStitch" ? "inkStitch" : "oneWay"}
                  onChange={(e) => {
                    const v = e.target.value;
                    up(v === "centre" ? { centerOut: true } : { centerOut: false, tatamiRoute: v as "oneWay" | "inkStitch" });
                  }}
                >
                  <option value="oneWay">{t("filum.pannelli.one_way")}</option>
                  <option value="centre">{t("filum.pannelli.centre_out")}</option>
                  <option value="inkStitch">Ink/Stitch</option>
                </select>
              </Row>
              <Row label={t("filum.pannelli.skip_last")} title={t("filum.pannelli.leave_out_the_last_stitch")}>
                <Toggle on={!!st.skipLast} onChange={(v) => up({ skipLast: v })} />
              </Row>
            </>
          )}
          {st.method === "spiral" && (
            <Row label={t("filum.pannelli.double_spiral")} title={t("filum.pannelli.in_on_every_other_ring")}>
              <Toggle on={!!st.contourDouble} onChange={(v) => up({ contourDouble: v })} />
            </Row>
          )}
          {(st.method === "contour" || st.method === "spiral") && (
            <Row label={t("filum.pannelli.clockwise")} title={t("filum.pannelli.go_round_clockwise_ink_stitch")}>
              <Toggle on={contourClockwise(st)} onChange={(v) => up({ contourClockwise: v, clockwise: undefined })} />
            </Row>
          )}
          {(st.method === "meander" || st.method === "circular" || st.method === "contour" || st.method === "spiral") && (
            <Row label={t("filum.pannelli.repeats")} title={t("filum.pannelli.the_path_sewn_this_many")}>
              <span className="dz-inline">
                <Num value={st.repeats ?? 1} step={1} min={1} max={5} digits={0} onChange={(v) => up({ repeats: Math.round(v) })} />
                <span className="stat">{t("filum.pannelli.bean")}</span>
                <Num value={st.beanRepeats ?? 0} step={2} min={0} max={6} digits={0} onChange={(v) => up({ beanRepeats: Math.round(v) })} />
              </span>
            </Row>
          )}
          {st.method === "tatami" && !st.gradient && (
            <Row label={t("filum.pannelli.carving")} title={t("filum.pannelli.needle_points_lined_up_into")}>
              <span className="dz-inline">
                <select className="select" value={st.carve ?? "none"} onChange={(e) => up({ carve: e.target.value as NonNullable<typeof st.carve> })}>
                  {(
                    [
                      ["none", t("filum.pannelli.none")],
                      ["diamonds", t("filum.pannelli.diamonds")],
                      ["waves", t("filum.pannelli.waves")],
                      ["chevrons", t("filum.pannelli.chevrons")],
                      ["bricks", t("filum.pannelli.bricks")],
                      ["circles", t("filum.pannelli.circles")],
                    ] as const
                  ).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
                {(st.carve ?? "none") !== "none" && <Num value={st.carveSize ?? 6} unit="mm" step={0.5} min={1} max={40} onChange={(v) => up({ carveSize: v })} />}
              </span>
            </Row>
          )}
          {st.method === "tartan" && st.tartan && <TartanSection t={st.tartan} />}
          {st.method === "cross" && (
            <>
              <Row label={t("filum.pannelli.cell")} title={t("filum.pannelli.size_of_one_cross")}>
                <Slider min={1} max={8} step={0.1} unit="mm" value={st.crossSize ?? 2.5} onChange={(v) => up({ crossSize: v })} />
              </Row>
              <Row label={t("filum.pannelli.cell_height")} title={t("filum.pannelli.cells_taller_or_flatter_than")}>
                <span className="dz-inline">
                  <span style={{ opacity: st.crossSizeY ? 1 : 0.55 }}>
                    <Num value={st.crossSizeY || st.crossSize || 2.5} step={0.1} min={0.8} max={12} unit="mm" onChange={(v) => up({ crossSizeY: Math.abs(v - (st.crossSize ?? 2.5)) < 1e-6 ? 0 : v })} />
                  </span>
                  {!!st.crossSizeY && (
                    <button className="btn sm ghost" onClick={() => up({ crossSizeY: 0 })}>
                      {t("filum.pannelli.square")}
                    </button>
                  )}
                </span>
              </Row>
              <Row label={t("filum.pannelli.coverage")} title={t("filum.pannelli.how_much_of_a_cell")}>
                <Slider min={10} max={100} step={5} digits={0} unit="%" value={Math.round((st.crossCoverage ?? 0.5) * 100)} onChange={(v) => up({ crossCoverage: v / 100 })} />
              </Row>
              <Row label={t("filum.pannelli.stitches")}>
                <div className="seg">
                  {(
                    [
                      ["cross", "×", t("filum.pannelli.both_diagonals")],
                      ["half", "/", t("filum.pannelli.half_cross_one_diagonal")],
                      ["upright", "+", t("filum.pannelli.upright_cross")],
                      ["double", "✳", t("filum.pannelli.double_cross_one_diagonal_the")],
                      ["smyrna", "⁜", t("filum.pannelli.smyrna_cross_the_diagonal_cross")],
                    ] as const
                  ).map(([k, l, t]) => (
                    <button key={k} title={t} className={(st.crossKind ?? "cross") === k ? "on" : ""} onClick={() => up({ crossKind: k })}>
                      {l}
                    </button>
                  ))}
                </div>
              </Row>
              {st.crossKind === "upright" && (
                <Row label={t("filum.pannelli.dense")} title={t("filum.pannelli.a_second_grid_of_upright")}>
                  <Toggle on={!!st.crossDense} onChange={(v) => up({ crossDense: v })} />
                </Row>
              )}
              <Row label={t("filum.pannelli.split_longer")} title={t("filum.pannelli.split_cross_stitches_longer_than")}>
                <Num value={st.crossMaxLength ?? 11} step={0.5} min={0} max={20} unit="mm" onChange={(v) => up({ crossMaxLength: v })} />
              </Row>
            </>
          )}
          {st.method === "tatami" && (
            <>
              <Row label={t("filum.pannelli.staggers")} title={t("filum.pannelli.rows_repeat_their_needle_pattern")}>
                <Num value={st.staggers} step={1} min={1} max={12} digits={0} onChange={(v) => up({ staggers: Math.round(v) })} />
              </Row>
              <Row label={t("filum.pannelli.gradient_end")} title={t("filum.pannelli.row_spacing_at_the_far")}>
                <Num value={st.endRowSpacing} step={0.05} min={0} unit="mm" onChange={(v) => up({ endRowSpacing: v })} />
              </Row>
              {st.endRowSpacing > 0 && (
                <Row label={t("filum.pannelli.even_blend")} title={t("filum.pannelli.change_the_density_not_the")}>
                  <Toggle on={!!st.gradientDensity} onChange={(v) => up({ gradientDensity: v })} />
                </Row>
              )}
              <Row label={t("filum.pannelli.pull_comp")} title={t("filum.pannelli.rows_grow_at_both_ends")}>
                <span className="dz-inline">
                  <Num value={st.pullComp} step={0.05} unit="mm" onChange={(v) => up({ pullComp: v })} />
                  <Num value={Math.round((st.pullCompPct ?? 0) * 100)} step={1} min={0} max={30} unit="%" digits={0} onChange={(v) => up({ pullCompPct: v / 100 })} />
                </span>
              </Row>
            </>
          )}
          {(st.method === "radial" || st.method === "circular") && (
            <div className="grid2">
              <div className="row">
                <label>{t("filum.pannelli.cx")}</label>
                <Num value={st.center[0]} step={0.05} min={0} max={1} onChange={(v) => up({ center: [v, st.center[1]] })} />
              </div>
              <div className="row">
                <label>{t("filum.pannelli.cy")}</label>
                <Num value={st.center[1]} step={0.05} min={0} max={1} onChange={(v) => up({ center: [st.center[0], v] })} />
              </div>
            </div>
          )}
          <Section
            title={t("filum.pannelli.underlay")}
            extra={<Toggle on={st.underlay || !!st.underlayAuto} onChange={(v) => up(v ? { underlay: true } : { underlay: false, underlayAuto: false })} />}
          >
            <Presets
              items={[
                [t("filum.pannelli.auto"), { underlayAuto: true, underlay: true }, t("filum.pannelli.chosen_by_the_shape_s")],
                [t("filum.pannelli.none"), { underlayAuto: false, underlay: false }, t("filum.pannelli.no_underlay_light_fills_stable")],
                [t("filum.pannelli.light"), { underlayAuto: false, underlay: true, underlaySpacing: 1.2, underlayInset: 0.4 }, t("filum.pannelli.open_grid_that_just_holds")],
                [t("filum.pannelli.standard"), { underlayAuto: false, underlay: true, underlaySpacing: 0.75, underlayInset: 0.3 }, t("filum.pannelli.good_for_most_fabrics")],
                [t("filum.pannelli.heavy"), { underlayAuto: false, underlay: true, underlaySpacing: 0.5, underlayInset: 0.2 }, t("filum.pannelli.stretchy_or_fluffy_fabrics_knits")],
              ]}
              value={
                st.underlayAuto
                  ? { underlayAuto: true, underlay: true }
                  : st.underlay
                    ? { underlayAuto: false, underlay: true, underlaySpacing: st.underlaySpacing, underlayInset: st.underlayInset }
                    : { underlayAuto: false, underlay: false }
              }
              onPick={(v) => up(v)}
            />
            {st.underlayAuto && <AutoUnderlayHint kind="fill" />}
            {st.underlay && !st.underlayAuto && (
              <>
                <Row label={t("filum.pannelli.edge_run")} title={t("filum.pannelli.a_running_stitch_just_inside")}>
                  <Toggle on={!!st.underlayEdge} onChange={(v) => up({ underlayEdge: v })} />
                </Row>
                <Row label={t("filum.pannelli.cross_hatch")} title={t("filum.pannelli.two_tatami_passes_crossing_at")}>
                  <Toggle on={!!st.underlayCross} onChange={(v) => up({ underlayCross: v })} />
                </Row>
                <Row label={t("filum.pannelli.skip_last")} title={t("filum.pannelli.leave_out_the_last_underlay")}>
                  <Toggle on={!!st.underlaySkipLast} onChange={(v) => up({ underlaySkipLast: v })} />
                </Row>
                <Row label={t("filum.pannelli.stitch_length")}>
                  <Num value={st.underlayStitchLength} step={0.5} min={1} max={6} unit="mm" onChange={(v) => up({ underlayStitchLength: v })} />
                </Row>
                <Row label={t("filum.pannelli.angle_rel")} title={t("filum.pannelli.relative_to_the_fill_angle")}>
                  <span className="dz-inline">
                    <Num value={st.underlayAngle} step={15} unit="°" onChange={(v) => up({ underlayAngle: v, underlayAngles: undefined })} />
                    <input
                      className="input"
                      style={{ width: 90 }}
                      placeholder={t("filum.pannelli.or_a_list")}
                      title={t("filum.pannelli.several_passes_angles_separated_by")}
                      defaultValue={(st.underlayAngles ?? []).join(" ")}
                      onBlur={(e) => {
                        const list = e.target.value.split(/[\s,]+/).map(Number).filter((x) => Number.isFinite(x) && e.target.value.trim() !== "");
                        up({ underlayAngles: list.length ? list : undefined });
                      }}
                    />
                  </span>
                </Row>
                <Row label={t("filum.pannelli.spacing")}>
                  <Num value={st.underlaySpacing} step={0.1} min={0.3} unit="mm" onChange={(v) => up({ underlaySpacing: v })} />
                </Row>
                <Row label={t("filum.pannelli.inset")}>
                  <Num value={st.underlayInset} step={0.1} min={0} unit="mm" onChange={(v) => up({ underlayInset: v })} />
                </Row>
              </>
            )}
          </Section>
        </>
      )}
      {st.type === "satin" && (
        <>
          {st.method === "satin" && (
            <Row label={t("filum.pannelli.density")}>
              <Presets
                items={[
                  [t("filum.pannelli.open"), 0.6, t("filum.pannelli.satin_06_light")],
                  [t("filum.pannelli.normal"), 0.4, t("filum.pannelli.satin_04_standard")],
                  [t("filum.pannelli.dense"), 0.3, t("filum.pannelli.satin_03_full")],
                ]}
                value={st.spacing}
                onPick={(v) => up({ spacing: v })}
              />
            </Row>
          )}
          {o.paths.length === 1 && (
            <Row label={t("filum.pannelli.width")}>
              <Slider min={0.5} max={12} step={0.1} value={st.width} unit="mm" {...sl("width")} />
            </Row>
          )}
          <Row label={t("filum.pannelli.spacing")}>
            <Slider min={0.2} max={2} step={0.01} value={st.spacing} unit="mm" {...sl("spacing")} />
          </Row>
          <Row label={t("filum.pannelli.pull_comp")}>
            <Num value={st.pullComp} step={0.05} unit="mm" onChange={(v) => up({ pullComp: v })} />
          </Row>
          <Row label={t("filum.pannelli.pull_comp_2")}>
            <Num value={st.pullCompPct} step={5} unit="%" onChange={(v) => up({ pullCompPct: v })} />
          </Row>
          <Row label={t("filum.pannelli.split_above")} title={t("filum.pannelli.split_stitches_longer_than_this")}>
            <Num value={st.maxStitchLength} step={0.5} min={0} unit="mm" onChange={(v) => up({ maxStitchLength: v })} />
          </Row>
          <Row label={t("filum.pannelli.short_stitch")} title={t("filum.pannelli.in_tight_curves_every_other")}>
            <span className="dz-inline">
              <Num value={st.shortStitchInset * 100} step={5} min={0} max={90} unit="%" digits={0} onChange={(v) => up({ shortStitchInset: v / 100 })} />
              <Num value={st.shortStitchDistance ?? 0.25} step={0.05} min={0} max={2} unit="mm" onChange={(v) => up({ shortStitchDistance: v })} />
            </span>
          </Row>
          <Row label={t("filum.pannelli.push_comp")} title={t("filum.pannelli.pull_the_column_s_ends")}>
            <Num value={st.pushComp ?? 0} step={0.1} min={0} max={3} unit="mm" onChange={(v) => up({ pushComp: v })} />
          </Row>
          {st.maxStitchLength > 0 && (
            <>
              <Row label={t("filum.pannelli.split_pattern")} title={t("filum.pannelli.where_long_stitches_are_split")}>
                <div className="seg">
                  {(
                    [
                      ["even", t("filum.pannelli.even"), { splitStaggers: 0, splitRandomPhase: false }],
                      // Ink/Stitch "simple": the same split points on every stitch
                      ["simple", t("filum.pannelli.simple"), { splitStaggers: 1, splitRandomPhase: false }],
                      ["s3", t("filum.pannelli.stagger_3"), { splitStaggers: 3, splitRandomPhase: false }],
                      ["s4", t("filum.pannelli.stagger_4"), { splitStaggers: 4, splitRandomPhase: false }],
                      ["random", t("filum.pannelli.random"), { splitStaggers: 0, splitRandomPhase: true }],
                    ] as const
                  ).map(([k, l, patch]) => {
                    const cur = st.splitRandomPhase ? "random" : (st.splitStaggers ?? 0) >= 4 ? "s4" : (st.splitStaggers ?? 0) >= 2 ? "s3" : st.splitStaggers === 1 ? "simple" : "even";
                    return (
                      <button key={k} className={cur === k ? "on" : ""} onClick={() => up(patch)}>
                        {l}
                      </button>
                    );
                  })}
                </div>
              </Row>
              {(st.splitStaggers ?? 0) < 2 && (
                <Row label={t("filum.pannelli.split_jitter")} title={st.splitRandomPhase ? t("filum.pannelli.vary_the_length_of_the") : t("filum.pannelli.move_every_split_point_by")}>
                  <span className="dz-inline">
                    <Num value={Math.round((st.splitJitter ?? 0) * 100)} step={5} min={0} max={100} unit="%" digits={0} onChange={(v) => up({ splitJitter: v / 100 })} />
                    {st.splitRandomPhase && (
                      <span title={t("filum.pannelli.split_stitches_longer_than_this_2")}>
                        <Num value={st.splitMinLength || st.maxStitchLength} step={0.5} min={0.5} max={st.maxStitchLength} unit={t("filum.pannelli.mm")} onChange={(v) => up({ splitMinLength: v >= st.maxStitchLength ? 0 : v })} />
                      </span>
                    )}
                  </span>
                </Row>
              )}
            </>
          )}
          <Row label={t("filum.pannelli.texture")} title={t("filum.pannelli.random_width_up_to_this")}>
            <span className="dz-inline">
              <Num value={Math.round((st.randomWider ?? 0) * 100)} step={5} min={0} max={50} unit="%+" digits={0} onChange={(v) => up({ randomWider: v / 100 })} />
              <Num value={Math.round((st.randomNarrower ?? 0) * 100)} step={5} min={0} max={50} unit="%−" digits={0} onChange={(v) => up({ randomNarrower: v / 100 })} />
              <span title={t("filum.pannelli.random_spacing_each_stitch_s")}>
                <Num value={Math.round((st.randomSpacing ?? 0) * 100)} step={5} min={0} max={100} unit="%↔" digits={0} onChange={(v) => up({ randomSpacing: v / 100 })} />
              </span>
              {((st.randomWider ?? 0) > 0 || (st.randomNarrower ?? 0) > 0 || (st.randomSpacing ?? 0) > 0 || (st.splitJitter ?? 0) > 0 || !!st.splitRandomPhase) && (
                <button className="btn sm ghost" title={t("filum.pannelli.another_random_pattern")} onClick={() => up({ randomSeed: ((st.randomSeed ?? 1) % 9973) + 1 })}>
                  {t("filum.pannelli.shuffle")}
                </button>
              )}
            </span>
          </Row>
          <Row label={t("filum.pannelli.direction")} title={t("filum.pannelli.direction_guides_lines_across_the")}>
            <GuideActions />
          </Row>
          <Row label={t("filum.pannelli.reverse")}>
            <Toggle on={st.reverse} onChange={(v) => up({ reverse: v })} />
          </Row>
          {o.paths.length > 1 && (
            <>
              <Row label={t("filum.pannelli.swap_rails")}>
                <Toggle on={st.swapRails} onChange={(v) => up({ swapRails: v })} />
              </Row>
              <Row label={t("filum.pannelli.rail_direction")} title={t("filum.pannelli.a_rail_drawn_the_other")}>
                <select className="select" value={st.reverseRails ?? "automatic"} onChange={(e) => up({ reverseRails: e.target.value as NonNullable<typeof st.reverseRails> })}>
                  <option value="automatic">{t("filum.pannelli.auto")}</option>
                  <option value="none">{t("filum.pannelli.as_drawn")}</option>
                  <option value="first">{t("filum.pannelli.reverse_first")}</option>
                  <option value="second">{t("filum.pannelli.reverse_second")}</option>
                  <option value="both">{t("filum.pannelli.reverse_both")}</option>
                </select>
              </Row>
            </>
          )}
          {!many && (
            <Section title={t("filum.pannelli.colour_stripes")} defaultOpen={false}>
              <MulticolorSatin o={o} />
            </Section>
          )}
          <Section title={t("filum.pannelli.underlay")}>
            <Presets
              items={[
                [t("filum.pannelli.auto"), { underlayAuto: true }, t("filum.pannelli.chosen_by_the_column_s")],
                [t("filum.pannelli.none"), { underlayAuto: false, centerWalk: false, contourUnderlay: false, zigzagUnderlay: false }, t("filum.pannelli.no_underlay_thin_columns")],
                [t("filum.pannelli.centre"), { underlayAuto: false, centerWalk: true, contourUnderlay: false, zigzagUnderlay: false }, t("filum.pannelli.centre_walk_narrow_columns_2")],
                [t("filum.pannelli.edges"), { underlayAuto: false, centerWalk: false, contourUnderlay: true, zigzagUnderlay: false }, t("filum.pannelli.contour_underlay_crisp_edges_2")],
                [t("filum.pannelli.full"), { underlayAuto: false, centerWalk: false, contourUnderlay: true, zigzagUnderlay: true }, t("filum.pannelli.contour_zig_zag_wide_columns")],
              ]}
              value={
                st.underlayAuto
                  ? { underlayAuto: true }
                  : { underlayAuto: false, centerWalk: st.centerWalk, contourUnderlay: st.contourUnderlay, zigzagUnderlay: st.zigzagUnderlay }
              }
              onPick={(v) => up(v)}
            />
            {st.underlayAuto && <AutoUnderlayHint kind="satin" />}
            {!st.underlayAuto && (
            <>
            <Row label={t("filum.pannelli.centre_walk")}>
              <Toggle on={st.centerWalk} onChange={(v) => up({ centerWalk: v })} />
            </Row>
            {st.centerWalk && (
              <Row label={t("filum.pannelli.walk")} title={t("filum.pannelli.passes_along_the_column_there")}>
                <span className="dz-inline">
                  <Num value={st.centerWalkRepeats ?? 2} step={2} min={2} max={8} digits={0} onChange={(v) => up({ centerWalkRepeats: Math.max(2, Math.round(v / 2) * 2) })} />
                  <Num value={Math.round((st.centerWalkPosition ?? 0.5) * 100)} step={5} min={0} max={100} unit="%" digits={0} onChange={(v) => up({ centerWalkPosition: v / 100 })} />
                </span>
              </Row>
            )}
            {(st.centerWalk || st.contourUnderlay) && (
              <Row label={t("filum.pannelli.run_length")} title={t("filum.pannelli.stitch_length_of_the_centre")}>
                <Num value={st.underlayStitchLength ?? 2.5} step={0.5} min={1} max={6} unit="mm" onChange={(v) => up({ underlayStitchLength: v })} />
              </Row>
            )}
            <Row label={t("filum.pannelli.contour")}>
              <Toggle on={st.contourUnderlay} onChange={(v) => up({ contourUnderlay: v })} />
            </Row>
            {st.contourUnderlay && (
              <Row label={t("filum.pannelli.contour_inset")} title={t("filum.pannelli.inset_from_the_edges_a")}>
                <span className="dz-inline">
                  <Num value={st.contourInset} step={0.1} min={0} unit="mm" onChange={(v) => up({ contourInset: v })} />
                  <Num value={Math.round((st.contourInsetPct ?? 0) * 100)} step={5} min={0} max={45} unit="%" digits={0} onChange={(v) => up({ contourInsetPct: v / 100 })} />
                </span>
              </Row>
            )}
            <Row label="Zig-zag">
              <Toggle on={st.zigzagUnderlay} onChange={(v) => up({ zigzagUnderlay: v })} />
            </Row>
            {st.zigzagUnderlay && (
              <>
                <Row label={t("filum.pannelli.zz_spacing")}>
                  <Num value={st.zigzagUnderlaySpacing} step={0.25} min={0.5} unit="mm" onChange={(v) => up({ zigzagUnderlaySpacing: v })} />
                </Row>
                <Row label={t("filum.pannelli.zz_inset")} title={t("filum.pannelli.inset_from_the_edges_a")}>
                  <span className="dz-inline">
                    <Num value={st.zigzagUnderlayInset} step={0.1} min={0} unit="mm" onChange={(v) => up({ zigzagUnderlayInset: v })} />
                    <Num value={Math.round((st.zigzagInsetPct ?? 0) * 100)} step={5} min={0} max={45} unit="%" digits={0} onChange={(v) => up({ zigzagInsetPct: v / 100 })} />
                  </span>
                </Row>
                <Row label={t("filum.pannelli.zz_split")} title={t("filum.pannelli.split_zig_zag_underlay_stitches")}>
                  <Num value={st.zigzagUnderlayMaxStitch ?? 0} step={0.5} min={0} max={10} unit="mm" onChange={(v) => up({ zigzagUnderlayMaxStitch: v })} />
                </Row>
              </>
            )}
            </>
            )}
          </Section>
        </>
      )}
      {st.type === "running" && st.zigzag && (
        <>
          <Row label={t("filum.pannelli.width")}>
            <Slider min={0.5} max={8} step={0.1} unit="mm" value={st.zigzag.width} onChange={(v) => up({ zigzag: { ...st.zigzag!, width: v } })} />
          </Row>
          <Row label={t("filum.pannelli.spacing")} title={t("filum.pannelli.length_of_one_zig_and")}>
            <Slider min={0.2} max={4} step={0.05} unit="mm" value={st.zigzag.spacing} onChange={(v) => up({ zigzag: { ...st.zigzag!, spacing: v } })} />
          </Row>
          <Row label={t("filum.pannelli.angle")} title={t("filum.pannelli.turn_every_zig_zag_by")}>
            <Slider min={-89} max={89} step={1} digits={0} unit="°" value={st.zigzag.angle} onChange={(v) => up({ zigzag: { ...st.zigzag!, angle: v } })} />
          </Row>
          <Row label={t("filum.pannelli.pull_comp")} title={t("filum.pannelli.widen_each_side_against_the")}>
            <Num value={st.zigzag.pullComp} step={0.05} min={-1} max={2} unit="mm" onChange={(v) => up({ zigzag: { ...st.zigzag!, pullComp: v } })} />
          </Row>
          <Row label={t("filum.pannelli.repeats")} title={t("filum.pannelli.passes_along_the_path_2")}>
            <Num value={st.repeats} step={1} min={1} max={9} digits={0} onChange={(v) => up({ repeats: Math.round(v) })} />
          </Row>
        </>
      )}
      {st.type === "running" && !st.zigzag && (
        <>
          <Row label={t("filum.pannelli.stitch")}>
            <Presets
              items={[
                ["Fine", 1.5, t("filum.pannelli.run_15_tight")],
                [t("filum.pannelli.normal"), 2.5, t("filum.pannelli.run_25_standard")],
                [t("filum.pannelli.long"), 3.5, t("filum.pannelli.run_35_straight")],
              ]}
              value={st.length}
              onPick={(v) => up({ length: v })}
            />
          </Row>
          <Row label={t("filum.pannelli.length")}>
            <Slider min={0.5} max={6} step={0.1} value={st.length} unit="mm" {...sl("length")} />
          </Row>
          <Row label={t("filum.pannelli.tolerance")} title={t("filum.pannelli.how_closely_stitches_follow_curves")}>
            <Num value={st.tolerance} step={0.05} min={0.01} unit="mm" onChange={(v) => up({ tolerance: v })} />
          </Row>
          <Row label={t("filum.pannelli.repeats")} title={t("filum.pannelli.passes_along_the_path_2_2")}>
            <Num value={st.repeats} step={1} min={1} max={9} digits={0} onChange={(v) => up({ repeats: Math.round(v) })} />
          </Row>
          <Row label={t("filum.pannelli.bean_repeats")} title={t("filum.pannelli.n0_single_2_triple_bean")}>
            <Num value={st.beanRepeats} step={2} min={0} max={8} digits={0} onChange={(v) => up({ beanRepeats: Math.round(v) })} />
          </Row>
          <CutworkSection o={o} />
          {!st.stem && !st.motif && (
            <Section title={t("filum.pannelli.length_pattern_texture")} defaultOpen={!!(st.lengthPattern?.length || st.beanPattern?.length || st.randomLength)}>
              <Row label={t("filum.pannelli.lengths")} title={t("filum.pannelli.several_stitch_lengths_used_in")}>
                <PatternInput
                  value={st.lengthPattern}
                  placeholder={t("filum.pannelli.length_even", { length: st.length })}
                  unit="mm"
                  parse={(t) => parsePattern(t, { min: 0.3, max: 12 })}
                  format={formatPattern}
                  onChange={(v) => up({ lengthPattern: v.length > 1 ? v : undefined, ...(v.length === 1 ? { length: v[0] } : {}) })}
                />
              </Row>
              <Row label={t("filum.pannelli.bean_pattern")} title={t("filum.pannelli.back_and_forth_repeats_per")}>
                <PatternInput
                  value={passesToBeans(st.beanPattern)}
                  placeholder={String(Math.ceil(st.beanRepeats / 2))}
                  parse={(t) => parsePattern(t, { min: 0, max: 5, integer: true })}
                  format={(v) => (v?.length ? formatPattern(v) : "")}
                  onChange={(v) => up({ beanPattern: v.length > 1 ? beansToPasses(v) : undefined, ...(v.length === 1 ? { beanRepeats: beansToPasses(v)[0] } : {}) })}
                />
              </Row>
              <RandomLength value={st.randomLength ?? 0} onChange={(v) => up({ randomLength: v })} onShuffle={() => up({ randomSeed: ((st.randomSeed ?? 1) % 9973) + 1 })} />
            </Section>
          )}
          {st.stem && (
            <Row label={t("filum.pannelli.rope_width")} title={t("filum.pannelli.how_far_the_stem_stitches")}>
              <Slider min={0.2} max={3} step={0.1} unit="mm" value={st.stem.width} onChange={(v) => up({ stem: { width: v } })} />
            </Row>
          )}
          {st.motif && (
            <>
              <Row label={t("filum.pannelli.motif")}>
                <select className="select" value={st.motif.kind} onChange={(e) => up({ motif: { ...st.motif!, kind: e.target.value as typeof st.motif.kind } })}>
                  {(
                    [
                      ["wave", t("filum.pannelli.wave")],
                      ["zigzag", "Zig-zag"],
                      ["scallop", t("filum.pannelli.scallop")],
                      ["loop", t("filum.pannelli.loops")],
                      ["diamond", t("filum.pannelli.diamonds")],
                      ["cross", t("filum.pannelli.crosses")],
                    ] as const
                  ).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label={t("filum.pannelli.motif_size")} title={t("filum.pannelli.length_of_one_motif_along")}>
                <Slider min={1.5} max={15} step={0.5} unit="mm" value={st.motif.size} onChange={(v) => up({ motif: { ...st.motif!, size: v } })} />
              </Row>
            </>
          )}
          {st.ripple && <RippleSection o={o} />}
        </>
      )}
      {st.type === "applique" && (
        <>
          <p className="hint" style={{ margin: "2px 0 8px" }}>
            {t("filum.pannelli.sews_the_placement_line_stops")}
          </p>
          <Section title={t("filum.pannelli.n1_placement_line")} extra={<Toggle on={st.placement} onChange={(v) => up({ placement: v })} />}>
            {st.placement && (
              <Row label={t("filum.pannelli.stitch_length")}>
                <Slider min={1} max={4} step={0.1} value={st.placementLength} unit="mm" {...sl("placementLength")} />
              </Row>
            )}
            {novaFields("placement")}
          </Section>
          <Section title={t("filum.pannelli.n2_tack_down")}>
            <Row label={t("filum.pannelli.stitch")}>
              <select className="select" style={{ width: "100%" }} value={st.tackdown} onChange={(e) => up({ tackdown: e.target.value })}>
                <option value="zigzag">Zig-zag</option>
                <option value="eStitch">{t("filum.pannelli.e_stitch")}</option>
                <option value="run">{t("filum.pannelli.running_stitch")}</option>
                <option value="none">{t("filum.pannelli.none")}</option>
              </select>
            </Row>
            {st.tackdown !== "none" && (
              <Row label={t("filum.pannelli.inset")} title={t("filum.pannelli.distance_inside_the_edge")}>
                <Slider min={0} max={3} step={0.05} value={st.tackdownInset} unit="mm" {...sl("tackdownInset")} />
              </Row>
            )}
            {(st.tackdown === "zigzag" || st.tackdown === "eStitch") && (
              <>
                <Row label={t("filum.pannelli.width")}>
                  <Slider min={0.5} max={4} step={0.1} value={st.tackdownWidth} unit="mm" {...sl("tackdownWidth")} />
                </Row>
                <Row label={t("filum.pannelli.spacing")}>
                  <Slider min={0.4} max={4} step={0.1} value={st.tackdownSpacing} unit="mm" {...sl("tackdownSpacing")} />
                </Row>
              </>
            )}
            {novaFields("tackdown")}
          </Section>
          <Section title={t("filum.pannelli.n3_cover")}>
            <Row label={t("filum.pannelli.stitch")}>
              <select className="select" style={{ width: "100%" }} value={st.cover} onChange={(e) => up({ cover: e.target.value })}>
                <option value="satin">Satin</option>
                <option value="eStitch">{t("filum.pannelli.e_stitch_blanket")}</option>
                <option value="none">{t("filum.pannelli.none_raw_edge")}</option>
              </select>
            </Row>
            {st.cover !== "none" && (
              <>
                <Row label={t("filum.pannelli.width")}>
                  <Slider min={1} max={8} step={0.1} value={st.coverWidth} unit="mm" {...sl("coverWidth")} />
                </Row>
                <Row label={t("filum.pannelli.spacing")}>
                  <Slider min={0.2} max={2.5} step={0.05} value={st.coverSpacing} unit="mm" {...sl("coverSpacing")} />
                </Row>
                <Row label={t("filum.pannelli.offset")} title={t("filum.pannelli.shift_the_cover_outwards_or")}>
                  <Slider min={-2} max={2} step={0.05} value={st.coverOffset} unit="mm" {...sl("coverOffset")} />
                </Row>
                <Row label={t("filum.pannelli.pull_comp")}>
                  <Num value={st.pullComp} step={0.05} unit="mm" onChange={(v) => up({ pullComp: v })} />
                </Row>
                <Row label={t("filum.pannelli.underlay")}>
                  <Toggle on={st.coverUnderlay} onChange={(v) => up({ coverUnderlay: v })} />
                </Row>
                {st.cover === "eStitch" && (
                  <Row label={t("filum.pannelli.flip_prongs")}>
                    <Toggle on={st.flip} onChange={(v) => up({ flip: v })} />
                  </Row>
                )}
              </>
            )}
            {novaFields("cover")}
          </Section>
          {novaFields("end")}
          <Row label={t("filum.pannelli.machine_stops")} title={t("filum.pannelli.stop_after_the_placement_line")}>
            <Toggle on={st.stops} onChange={(v) => up({ stops: v })} />
          </Row>
        </>
      )}
      {st.type === "manual" && (
        <>
          <div className="hint">
            {t("filum.pannelli.every_node_is_a_needle")}{" "}
            <button className="link" onClick={() => useStore.getState().setDialog("rebuild")} title={t("filum.pannelli.turn_the_stitches_back_into")}>
              {t("filum.pannelli.rebuild_shapes_from_the_stitches")}
            </button>
          </div>
          <Row label={t("filum.pannelli.split_longer")} title={t("filum.pannelli.split_stitches_longer_than_this_3")}>
            <Num value={st.maxLength ?? 0} step={0.5} min={0} max={12} unit="mm" onChange={(v) => up({ maxLength: v || undefined })} />
          </Row>
          <Row label={t("filum.pannelli.bean_pattern")} title={t("filum.pannelli.back_and_forth_repeats_per_2")}>
            <PatternInput
              value={passesToBeans(st.beanPattern)}
              placeholder="0"
              parse={(t) => parsePattern(t, { min: 0, max: 5, integer: true })}
              format={(v) => (v?.length ? formatPattern(v) : "")}
              onChange={(v) => up({ beanPattern: v.some((x) => x > 0) ? beansToPasses(v) : undefined })}
            />
          </Row>
        </>
      )}
      {/* NOVAstitch: the fields the modules register for this Filum type, after its own (module j: 3D foam on a satin);
          the appliqué places them in its steps, above */}
      {st.type !== "applique" && novaFields("end")}
    </>
  );
}

/** Properties of several selected objects: transform, align, colour. */
function MultiProperties({ objects }: { objects: DesignObject[] }) {
  const threads = useStore((s) => s.doc.threads);
  const ids = objects.map((o) => o.id);
  const types = [...new Set(objects.map((o) => o.stitch.type))];
  return (
    <div className="props">
      <div className="props-head">
        <span className="grow">{t("filum.pannelli.objects_objects", { objects: objects.length })}</span>
        <span className="stat">{types.join(" · ")}</span>
      </div>
      {(() => {
        const pair = guidePair(objects);
        if (!pair) return null;
        return (
          <Section title={t("filum.pannelli.ripple_guide")}>
            <p className="hint" style={{ margin: "2px 0 6px" }}>
              {pair.guide.stitch.type === "satin" && pair.guide.paths.length >= 2 ? t("filum.pannelli.copies_follow_guide_rails", { ripple: pair.ripple.name, guide: pair.guide.name }) : t("filum.pannelli.copies_follow_guide", { ripple: pair.ripple.name, guide: pair.guide.name })}
            </p>
            <button
              className="btn primary sm"
              onClick={() => {
                useStore.getState().commit((d) => useAsRippleGuide(d, pair.ripple.id, pair.guide.id));
                useStore.getState().set({ selection: [pair.ripple.id] });
              }}
            >
              {t("filum.pannelli.use_as_ripple_guide")}
            </button>
          </Section>
        );
      })()}
      {(() => {
        const pair = guidePair(objects) ? null : patternPair(objects);
        if (!pair) return null;
        return (
          <Section title={t("filum.pannelli.stitch_pattern")} defaultOpen={false}>
            <p className="hint" style={{ margin: "2px 0 6px" }}>
              {t("filum.pannelli.draw_over_name_lines_add", { name: pair.target.name })}</p>
            <button
              className="btn sm"
              onClick={() => {
                useStore.getState().commit((d) => applyPatterns(d, pair.target.id, pair.patterns.map((p) => p.id)));
                useStore.getState().set({ selection: [pair.target.id] });
              }}
            >
              {pair.patterns.length > 1 ? t("filum.pannelli.use_these_as_stitch_pattern", { n: pair.patterns.length }) : t("filum.pannelli.use_it_as_stitch_pattern")}
            </button>
          </Section>
        );
      })()}
      <Section title={t("filum.pannelli.transform")}>
        <TransformPanel objects={objects} />
      </Section>
      <MultiStitchOptions objects={objects} />
      <Section title={t("filum.pannelli.thread_2")}>
        <ThreadPicker
          value={objects[0]?.thread}
          mixed={!objects.every((o) => o.thread === objects[0]?.thread)}
          // letters: their lettering keeps the colour (all its letters of that colour take it)
          onPick={(id) => useStore.getState().commit((d) => ({ ...d, objects: setObjectsThread(d.objects, ids, id) }))}
        />
        {!objects.every((o) => o.thread === objects[0]?.thread) && <p className="hint">{t("filum.pannelli.n_colours_pick_one", { n: new Set(objects.map((o) => o.thread)).size })}</p>}
        {threads.length === 0 && <p className="hint">{t("filum.pannelli.no_threads_yet")}</p>}
      </Section>
      <CommandsSection objects={objects} />
      <ElementInfoSection ids={ids} />
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = { fill: "Fill", satin: "Satin", running: "Line", applique: "Appliqué", manual: "Manual stitch", none: "No stitches", zigzag: "Zig-zag" };

/**
 * Several objects selected: their stitch settings, one panel per stitch type,
 * each change going to every selected object of that type. Linked clones
 * follow their original and gradient or tartan layers are edited as a set,
 * so they're left out here.
 */
function MultiStitchOptions({ objects }: { objects: DesignObject[] }) {
  const editable = objects.filter((o) => !o.clone && !o.locked && !(o.stitch.type === "fill" && (o.stitch.gradient || o.stitch.tartan)));
  const skipped = objects.length - editable.length;
  const groups = new Map<string, DesignObject[]>();
  for (const o of editable) groups.set(o.stitch.type, [...(groups.get(o.stitch.type) ?? []), o]);
  if (!groups.size)
    return skipped ? (
      <Section title={t("filum.pannelli.stitch_options")}>
        <p className="hint">{t("filum.pannelli.linked_clones_locked_objects_gradients")}</p>
      </Section>
    ) : null;
  return (
    <>
      {[...groups].map(([type, objs]) => {
        const differ = differingSettings(objs);
        return (
          <Section key={type} title={t("filum.pannelli.stitch_options_type", { type: TYPE_LABEL[type] ?? type }) + (groups.size > 1 || objs.length !== objects.length ? ` (${objs.length})` : "")}>
            <p className="hint" style={{ margin: "2px 0 6px" }}>
              {objs.length > 1 ? t("filum.pannelli.changes_apply_to_all_length", { length: objs.length }) : t("filum.pannelli.changes_apply_to_this_one")}
              {differ.length > 0 && (differ.length > 5 ? t("filum.pannelli.they_differ_in_more", { list: differ.slice(0, 5).map(settingLabel).join(", "), more: differ.length - 5 }) : t("filum.pannelli.they_differ_in", { list: differ.slice(0, 5).map(settingLabel).join(", ") }))}
            </p>
            <EditTargets.Provider value={objs.map((o) => o.id)}>
              <StitchOptions o={objs[0]} />
            </EditTargets.Provider>
          </Section>
        );
      })}
      {skipped > 0 && <p className="hint">{t("filum.pannelli.skipped_not_included_linked_clones", { skipped })}</p>}
    </>
  );
}

export function PropertiesPanel() {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const textGroup = useSelectedTextGroup();
  if (textGroup) return <TextProperties group={textGroup} />;
  const sel = doc.objects.filter((o) => selection.includes(o.id));
  // the colour layers of one gradient are edited as one object
  const gradGroup = sel[0]?.stitch.type === "fill" ? sel[0].stitch.gradient?.group : undefined;
  const oneGradient = !!gradGroup && sel.every((x) => x.stitch.type === "fill" && x.stitch.gradient?.group === gradGroup);
  if (sel.length > 1 && !oneGradient) return <MultiProperties objects={sel} />;
  if (!sel.length)
    return (
      <div className="props">
        <div className="hint" style={{ padding: "10px 2px" }}>{t("filum.pannelli.select_an_object_to_see")}</div>
      </div>
    );
  const o = oneGradient ? [...sel].sort((a, b) => ((a.stitch as { gradient?: { layer: number } }).gradient?.layer ?? 0) - ((b.stitch as { gradient?: { layer: number } }).gradient?.layer ?? 0))[0] : sel[0];
  return (
    <div className="props">
      <div className="props-head">
        <span className="swatch" style={{ background: doc.threads.find((t) => t.id === o.thread)?.color }} />
        <span className="grow">{o.name}</span>
        <button className="icon-btn" title={o.visible ? t("filum.pannelli.hide") : t("filum.pannelli.show")} onClick={() => useStore.getState().updateObject(o.id, { visible: !o.visible })}>
          {o.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button className="icon-btn" title={o.locked ? t("filum.pannelli.unlock") : t("filum.pannelli.lock")} onClick={() => useStore.getState().updateObject(o.id, { locked: !o.locked })}>
          {o.locked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
      </div>
      <Section title={t("filum.pannelli.transform")}>
        <TransformPanel objects={[o]} />
        <Row label={t("filum.pannelli.nodes")}>{nodeCount(o)}</Row>
      </Section>
      {!oneGradient && (
      <Section title={t("filum.pannelli.thread_2")}>
        <ThreadCard threadId={o.thread} />
        <ThreadPicker value={o.thread} onPick={(id) => useStore.getState().updateObject(o.id, { thread: id })} />
      </Section>
      )}
      {!!o.patterns?.length && (
        <Section title={t("filum.pannelli.stitch_patterns")}>
          <PatternList o={o} />
        </Section>
      )}
      {o.clone ? (
        <Section title={t("filum.pannelli.clone")}>
          <CloneInfo o={o} />
        </Section>
      ) : (
        <Section title={t("filum.pannelli.stitch_options")}>
          <StitchOptions o={o} />
        </Section>
      )}
      {!o.clone && <ObjectHiddenSection o={o} />}
      <CommandsSection objects={oneGradient ? sel : [o]} />
      <ElementInfoSection ids={oneGradient ? sel.map((x) => x.id) : [o.id]} />
    </div>
  );
}

export function IssuesPanel() {
  const doc = useStore((s) => s.doc);
  const plan = useStore((s) => s.plan);
  const view = useStore((s) => s.view);
  const issues = computeIssues(doc, plan);
  const tiny = cleanupCandidates(doc);
  const cleanup = tiny.length ? (
    <div className="issue-cleanup">
      <span>
        {tiny.length > 1
          ? tx("filum.pannelli.tiny_objects_under_many", { n: <b>{tiny.length}</b> }, { area: DEFAULT_CLEANUP.minFillArea, length: DEFAULT_CLEANUP.minLength })
          : tx("filum.pannelli.tiny_objects_under_one", { n: <b>{tiny.length}</b> }, { area: DEFAULT_CLEANUP.minFillArea, length: DEFAULT_CLEANUP.minLength })}
      </span>
      <button
        className="btn sm"
        title={t("filum.pannelli.remove_them_in_one_step")}
        onClick={() => {
          const s = useStore.getState();
          const n = cleanupDocument(s.commit, s.doc);
          s.toast(tn("filum.pannelli.removed_n_objects", n));
        }}
      >
        {t("filum.pannelli.clean_up")}
      </button>
    </div>
  ) : null;
  if (!issues.length) return cleanup ?? <div className="hint" style={{ padding: 14 }}>{t("filum.pannelli.no_problems_found_markers_appear")}</div>;
  const locate = (i: Issue) => {
    const s = useStore.getState();
    if (i.objId) s.select([i.objId]);
    const el = document.querySelector(".canvas-wrap")!.getBoundingClientRect();
    s.setView({ ox: el.width / 2 - i.at[0] * view.scale, oy: el.height / 2 - i.at[1] * view.scale });
  };
  return (
    <div>
      {cleanup}
      {issues.map((i) => {
        const o = doc.objects.find((x) => x.id === i.objId);
        return (
          <div key={i.id} className="issue" onClick={() => locate(i)}>
            <SeverityIcon level={i.level} />
            <div>
              <b>
                <IssueTopic title={i.title} />
                {i.title}
              </b>
              <span className="stat">
                {o ? `${o.name} · ` : ""}
                {i.detail}
              </span>
            </div>
            {i.fix && o && (
              <button
                className="btn sm"
                onClick={(e) => {
                  e.stopPropagation();
                  // a fix may remove the object (null)
                  useStore.getState().commit((d) =>
                    pruneGroups({
                      ...d,
                      objects: d.objects.flatMap((x) => {
                        if (!(i.fix!.scope ? i.fix!.scope(x) : x.id === o.id)) return [x];
                        const y = i.fix!.apply(x);
                        return y ? [y] : [];
                      }),
                    }),
                  );
                }}
              >
                {i.fix.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Issues worth a badge on the tab (warnings and errors). */
export function useIssueCount() {
  return useStore((s) => computeIssues(s.doc, s.plan).filter((i) => i.level !== "info").length);
}

/** Random stitch length (Ink/Stitch): off, or ± a share of every stitch, with a new pattern on Shuffle. */
function RandomLength({ value, onChange, onShuffle }: { value: number; onChange: (v: number) => void; onShuffle: () => void }) {
  return (
    <Row label={t("filum.pannelli.random_length")} title={t("filum.pannelli.vary_every_stitch_length_by")}>
      <span className="dz-inline">
        <Toggle on={value > 0} onChange={(on) => onChange(on ? 10 : 0)} />
        {value > 0 && (
          <>
            <Num value={value} step={5} min={1} max={90} digits={0} unit="%" onChange={onChange} />
            <button className="btn sm ghost" title={t("filum.pannelli.another_random_pattern")} onClick={onShuffle}>
              {t("filum.pannelli.shuffle")}
            </button>
          </>
        )}
      </span>
    </Row>
  );
}

/** A per-object value that falls back to a design-wide one (shown greyed until set). */
/** Ripple stitch settings (Ink/Stitch ripple stitch): lines, guide, copies, grid. */
function RippleSection({ o }: { o: DesignObject }) {
  const st = o.stitch;
  if (!isRipple(o) || st.type !== "running" || !st.ripple) return null;
  const r = st.ripple;
  const targets = useEditTargets(o);
  // every target keeps its own ripple settings and takes just the change
  const up = (patch: Partial<typeof r>) => {
    const ids = new Set(targets);
    useStore.getState().commit((d) => ({
      ...d,
      objects: d.objects.map((x) => (ids.has(x.id) && x.stitch.type === "running" && x.stitch.ripple ? { ...x, stitch: { ...x.stitch, ripple: { ...x.stitch.ripple, ...patch } } } : x)),
    }));
  };
  const closed = o.paths.length === 1 && o.paths[0].closed;
  const rails = o.paths.filter((p) => !p.closed).length >= 2;
  const guide = r.guide ?? [];
  const satinGuide = guide.length >= 2;
  return (
    <>
      <Section title={t("filum.pannelli.ripple")}>
        <Row label={t("filum.pannelli.lines")} title={t("filum.pannelli.how_many_ripples_a_count")}>
          <span className="dz-inline">
            <div className="seg">
              <button className={!(r.minLineDist ?? 0) ? "on" : ""} onClick={() => up({ minLineDist: 0 })}>
                {t("filum.pannelli.count")}
              </button>
              <button className={(r.minLineDist ?? 0) > 0 ? "on" : ""} onClick={() => up({ minLineDist: r.minLineDist || 2 })}>
                {t("filum.pannelli.distance")}
              </button>
            </div>
            {(r.minLineDist ?? 0) > 0 ? (
              <Num value={r.minLineDist!} step={0.25} min={0.2} max={20} unit="mm" onChange={(v) => up({ minLineDist: v })} />
            ) : (
              <Num value={r.lines} step={1} min={1} max={200} digits={0} onChange={(v) => up({ lines: Math.round(v) })} />
            )}
          </span>
        </Row>
        {closed ? (
          <Row label={t("filum.pannelli.inner_size")} title={t("filum.pannelli.size_of_the_innermost_ripple")}>
            <Slider min={0} max={0.95} step={0.01} value={r.minScale} onChange={(v) => up({ minScale: v })} />
          </Row>
        ) : (
          !rails &&
          !guide.length &&
          !r.fan && (
            <Row label={t("filum.pannelli.spacing")} title={t("filum.pannelli.distance_between_the_copies")}>
              <Slider min={0.3} max={10} step={0.1} unit="mm" value={r.spacing} onChange={(v) => up({ spacing: v })} />
            </Row>
          )
        )}
        <Row label={t("filum.pannelli.spread")} title={t("filum.pannelli.bunch_the_ripples_towards_one")}>
          <span className="dz-inline">
            <Slider min={0.25} max={4} step={0.05} value={r.exponent ?? 1} onChange={(v) => up({ exponent: v })} />
            <Toggle on={!!r.flipExponent} onChange={(v) => up({ flipExponent: v })} title={t("filum.pannelli.flip")} />
          </span>
        </Row>
        <Row label={t("filum.pannelli.skip")} title={t("filum.pannelli.leave_out_ripples_at_the")}>
          <span className="dz-inline">
            <Num value={r.skipStart ?? 0} step={1} min={0} max={50} digits={0} unit={t("filum.pannelli.start")} onChange={(v) => up({ skipStart: Math.round(v) })} />
            <Num value={r.skipEnd ?? 0} step={1} min={0} max={50} digits={0} unit={t("filum.pannelli.end")} onChange={(v) => up({ skipEnd: Math.round(v) })} />
          </span>
        </Row>
        <Row label={t("filum.pannelli.twist")} title={t("filum.pannelli.rotation_from_the_first_to")}>
          <Slider min={-360} max={360} step={1} digits={0} unit="°" value={r.rotation} onChange={(v) => up({ rotation: v })} />
        </Row>
        <Row label={t("filum.pannelli.reverse")} title={t("filum.pannelli.start_at_the_centre_far")}>
          <Toggle on={r.reverse} onChange={(v) => up({ reverse: v })} />
        </Row>
      </Section>
      {!closed && (
        <Section title={t("filum.pannelli.copies")} defaultOpen={!!(r.joinPoint || r.flipCopies === false || r.staggers)}>
          <Row label={t("filum.pannelli.back_and_forth")} title={t("filum.pannelli.sew_every_other_copy_backwards")}>
            <Toggle on={r.flipCopies ?? true} onChange={(v) => up({ flipCopies: v })} />
          </Row>
          <Row label={t("filum.pannelli.joins")} title={t("filum.pannelli.where_copies_meet_flat_connections")}>
            <div className="seg">
              <button className={!r.joinPoint ? "on" : ""} onClick={() => up({ joinPoint: false })}>
                {t("filum.pannelli.flat")}
              </button>
              <button className={r.joinPoint ? "on" : ""} onClick={() => up({ joinPoint: true })}>
                {t("filum.pannelli.point")}
              </button>
            </div>
          </Row>
          <Row label={t("filum.pannelli.staggers")} title={t("filum.pannelli.needle_points_shifted_from_line")}>
            <Num value={r.staggers ?? 0} step={1} min={0} max={12} digits={0} onChange={(v) => up({ staggers: Math.round(v) })} />
          </Row>
          {!rails && !guide.length && (
            <Row label={t("filum.pannelli.towards_target")} title={t("filum.pannelli.without_a_guide_parallel_copies")}>
              <div className="seg">
                <button className={!r.fan ? "on" : ""} onClick={() => up({ fan: false })}>
                  {t("filum.pannelli.parallel")}
                </button>
                <button className={r.fan ? "on" : ""} onClick={() => up({ fan: true })}>
                  {t("filum.pannelli.fan")}
                </button>
              </div>
            </Row>
          )}
          <Row label={t("filum.pannelli.manual_points")} title={t("filum.pannelli.the_outline_s_own_points")}>
            <Toggle on={!!r.manual} onChange={(v) => up({ manual: v })} />
          </Row>
        </Section>
      )}
      {!closed && !rails && (
        <Section title={t("filum.pannelli.guide")} defaultOpen={guide.length > 0}>
          {guide.length ? (
            <>
              <p className="hint" style={{ margin: "2px 0 6px" }}>
                {satinGuide ? t("filum.pannelli.copies_are_fitted_between_the") : t("filum.pannelli.copies_follow_the_guide_line")}
              </p>
              <Row label={t("filum.pannelli.scale")} title={t("filum.pannelli.size_of_the_first_and")}>
                <span className="dz-inline">
                  <Num value={r.scaleStart ?? 100} step={5} min={0} max={400} digits={0} unit="%" onChange={(v) => up({ scaleStart: v })} />
                  <Num value={r.scaleEnd ?? 100} step={5} min={0} max={400} digits={0} unit="%" onChange={(v) => up({ scaleEnd: v })} />
                </span>
              </Row>
              <Row label={t("filum.pannelli.scale_axes")}>
                <div className="seg">
                  {(
                    [
                      ["both", "X Y"],
                      ["x", "X"],
                      ["y", "Y"],
                      ["none", t("filum.pannelli.none")],
                    ] as const
                  ).map(([k, l]) => (
                    <button key={k} className={(r.scaleAxis ?? "both") === k ? "on" : ""} onClick={() => up({ scaleAxis: k })}>
                      {l}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label={t("filum.pannelli.turn_with_guide")} title={t("filum.pannelli.copies_turn_with_the_guide")}>
                <Toggle on={r.rotateRipples ?? true} onChange={(v) => up({ rotateRipples: v })} />
              </Row>
              {satinGuide && (
                <Row label={t("filum.pannelli.copies_at")} title={t("filum.pannelli.by_the_line_count_at")}>
                  <div className="seg">
                    {(
                      [
                        ["lineCount", t("filum.pannelli.count")],
                        ["rungs", t("filum.pannelli.rungs")],
                        ["adaptive", t("filum.pannelli.fit")],
                      ] as const
                    ).map(([k, l]) => (
                      <button key={k} className={(r.guidePosition ?? "lineCount") === k ? "on" : ""} onClick={() => up({ guidePosition: k })}>
                        {l}
                      </button>
                    ))}
                  </div>
                </Row>
              )}
              <button className="btn sm ghost" onClick={() => up({ guide: undefined, anchor: undefined })}>
                {t("filum.pannelli.remove_guide")}
              </button>
            </>
          ) : (
            <>
              <p className="hint" style={{ margin: "2px 0 6px" }}>
                {t("filum.pannelli.copies_can_follow_a_guide")}
              </p>
              <button
                className="btn sm"
                onClick={() => {
                  const g = defaultRippleGuide(o);
                  if (g) up({ guide: [g], scaleStart: 100, scaleEnd: 100 });
                }}
              >
                {t("filum.pannelli.add_a_straight_guide")}
              </button>
            </>
          )}
        </Section>
      )}
      <Section title={t("filum.pannelli.grid")} defaultOpen={(r.gridSize ?? 0) > 0}>
        <Row label={t("filum.pannelli.grid")} title={t("filum.pannelli.lines_across_the_ripples_their")}>
          <span className="dz-inline">
            <Toggle on={(r.gridSize ?? 0) > 0} onChange={(on) => up({ gridSize: on ? 3 : 0 })} />
            {(r.gridSize ?? 0) > 0 && <Num value={r.gridSize!} step={0.5} min={0.5} max={30} unit="mm" onChange={(v) => up({ gridSize: v })} />}
          </span>
        </Row>
        {(r.gridSize ?? 0) > 0 && (
          <Row label={t("filum.pannelli.grid_first")} title={t("filum.pannelli.sew_the_grid_before_the")}>
            <Toggle on={!!r.gridFirst} onChange={(v) => up({ gridFirst: v })} />
          </Row>
        )}
      </Section>
      {(closed || !guide.length || r.fan) && (
        <p className="hint">
          {closed ? t("filum.pannelli.drag_the_target_handle_on") : t("filum.pannelli.drag_the_target_handle_to")}
          {r.target && (
            <button className="btn sm ghost" onClick={() => up({ target: undefined })} style={{ marginLeft: 6 }}>
              {t("filum.pannelli.reset")}
            </button>
          )}
        </p>
      )}
    </>
  );
}

/** A linked clone: what it follows, its own fill angle, and unlinking it. */
function CloneInfo({ o }: { o: DesignObject }) {
  const doc = useStore((s) => s.doc);
  const link = o.clone!;
  const src = doc.objects.find((x) => x.id === link.of);
  const fill = o.stitch.type === "fill" ? o.stitch : null;
  const setLink = (patch: Partial<typeof link>) => useStore.getState().updateObject(o.id, { clone: { ...link, ...patch } });
  return (
    <>
      <p className="hint" style={{ margin: "2px 0 6px" }}>
        {t("filum.pannelli.follows_n_its_shape_and", { n: src?.name ?? "?" })}</p>
      {fill && (
        <Row label={t("filum.pannelli.own_angle")} title={t("filum.pannelli.keep_this_fill_angle_instead")}>
          <span className="dz-inline">
            <Toggle on={link.angle != null} onChange={(on) => setLink({ angle: on ? fill.angle : undefined })} />
            {link.angle != null && <Num value={link.angle} step={5} min={-180} max={180} digits={0} unit="°" onChange={(v) => setLink({ angle: v })} />}
          </span>
        </Row>
      )}
      <div className="dz-inline" style={{ marginTop: 6 }}>
        {src && (
          <button className="btn sm" onClick={() => useStore.getState().select([src.id])}>
            {t("filum.pannelli.select_original")}
          </button>
        )}
        <button
          className="btn sm ghost"
          title={t("filum.pannelli.make_it_a_plain_copy")}
          onClick={() => useStore.getState().commit((d) => ({ ...d, objects: d.objects.map((x) => (x.id === o.id ? unlinkClone(x) : x)) }))}
        >
          {t("filum.pannelli.unlink")}
        </button>
      </div>
    </>
  );
}

/** Below an original: how many clones follow it. */
export function cloneCount(doc: { objects: DesignObject[] }, id: string) {
  return clonesOf(doc as never, id).length;
}

/** The stitch patterns drawn over an object: what each does, its interval, removing it. */
function PatternList({ o }: { o: DesignObject }) {
  const pats = o.patterns ?? [];
  const set = (k: number, patch: Partial<(typeof pats)[number]> | null) =>
    useStore.getState().updateObject(o.id, { patterns: pats.flatMap((p, i) => (i !== k ? [p] : patch ? [{ ...p, ...patch }] : [])) });
  return (
    <>
      {pats.map((p, k) => (
        <div key={k} className="pattern-item">
          <Row label={t("filum.pannelli.pattern_v1", { v1: k + 1 })} title={t("filum.pannelli.lines_add_a_needle_point")}>
            <div className="seg">
              <button className={p.add && !p.remove ? "on" : ""} onClick={() => set(k, { add: true, remove: false })}>
                {t("filum.pannelli.add_points")}
              </button>
              <button className={p.remove && !p.add ? "on" : ""} onClick={() => set(k, { add: false, remove: true })}>
                {t("filum.pannelli.leave_out")}
              </button>
              <button className={p.add && p.remove ? "on" : ""} onClick={() => set(k, { add: true, remove: true })}>
                {t("filum.pannelli.both")}
              </button>
            </div>
          </Row>
          {p.add && (
            <Row label={t("filum.pannelli.interval")} title={t("filum.pannelli.which_crossings_get_a_point")}>
              <span className="dz-inline">
                <PatternInput value={p.interval} placeholder="1" parse={(t) => parsePattern(t, { min: 1, max: 20, integer: true })} format={(v) => (v?.length ? formatPattern(v) : "")} onChange={(v) => set(k, { interval: v })} />
                <Num value={p.offset} step={1} min={0} max={50} digits={0} unit={t("filum.pannelli.skip_2")} onChange={(v) => set(k, { offset: Math.round(v) })} />
              </span>
            </Row>
          )}
          <button className="btn sm ghost" onClick={() => set(k, null)}>
            {t("filum.pannelli.remove_pattern")}
          </button>
        </div>
      ))}
    </>
  );
}
