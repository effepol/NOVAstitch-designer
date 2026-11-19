// Meander fill pattern: Filum's three lattices or one of the 75
// Ink/Stitch meander tiles (bundled in the engine). Previews are drawn from
// the tiles' segments, repeated along their two repeat vectors.

import { t } from "../nova/i18n/filum";
import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Grip, useMovable } from "./ui";
import { engine } from "../engine/client";
import type { MeanderPattern, MeanderTile } from "../types";

let tilesLoad: Promise<MeanderTile[]> | null = null;
export function loadTiles(): Promise<MeanderTile[]> {
  tilesLoad ??= engine.meanderTiles().catch(() => {
    tilesLoad = null;
    return [];
  });
  return tilesLoad;
}

function useTiles(): MeanderTile[] | null {
  const [tiles, setTiles] = useState<MeanderTile[] | null>(null);
  useEffect(() => {
    let live = true;
    loadTiles().then((t) => live && setTiles(t));
    return () => {
      live = false;
    };
  }, []);
  return tiles;
}

// the built-in lattices as tiles (2.5 mm cells, as at the default scale)
const A = 2.5;
const H = (A * Math.sqrt(3)) / 2;
type Lattice = MeanderTile & { pattern: MeanderPattern; title: string };
const LATTICES: Lattice[] = [
  { pattern: "square", id: "square", get name() { return t("filum.pannelli.square"); }, get title() { return t("filum.pannelli.right_angle_turns_classic_meander"); }, shift0: [A, 0], shift1: [0, A], lines: [[0, 0, A, 0], [0, 0, 0, A]] },
  {
    pattern: "triangle",
    id: "triangle",
    get name() { return t("filum.pannelli.triangle"); },
    get title() { return t("filum.pannelli.angular_zig_zagging_walk"); },
    shift0: [A, 0],
    shift1: [A / 2, H],
    lines: [[0, 0, A, 0], [0, 0, A / 2, H], [A, 0, A / 2, H]],
  },
  {
    pattern: "hexagon",
    id: "hexagon-lattice",
    get name() { return t("filum.pannelli.honeycomb"); },
    get title() { return t("filum.pannelli.organic_cell_like_walk"); },
    shift0: [Math.sqrt(3) * A, 0],
    shift1: [(Math.sqrt(3) * A) / 2, 1.5 * A],
    lines: [[0, 0, 0, A], [0, 0, (-Math.sqrt(3) * A) / 2, -0.5 * A], [0, 0, (Math.sqrt(3) * A) / 2, -0.5 * A]],
  },
];

/** A tile repeated over a square window around its centre. */
export function TilePreview({ tile, size = 44 }: { tile: MeanderTile; size?: number }) {
  const d = useMemo(() => {
    const [a, b] = [tile.shift0, tile.shift1];
    const span = Math.max(Math.hypot(...a), Math.hypot(...b), ...tile.lines.flatMap(([x1, y1, x2, y2]) => [Math.abs(x1), Math.abs(y1), Math.abs(x2), Math.abs(y2)]));
    const half = span * 1.25;
    const parts: string[] = [];
    const reach = Math.ceil((half * 2) / Math.max(1e-6, Math.min(Math.hypot(...a), Math.hypot(...b)))) + 2;
    for (let i = -reach; i <= reach; i++)
      for (let j = -reach; j <= reach; j++) {
        const ox = i * a[0] + j * b[0];
        const oy = i * a[1] + j * b[1];
        if (Math.abs(ox) > half + span || Math.abs(oy) > half + span) continue;
        for (const [x1, y1, x2, y2] of tile.lines) parts.push(`M${(x1 + ox).toFixed(2)} ${(y1 + oy).toFixed(2)}L${(x2 + ox).toFixed(2)} ${(y2 + oy).toFixed(2)}`);
      }
    return { path: parts.join(""), half };
  }, [tile]);
  return (
    <svg className="tile-preview" width={size} height={size} viewBox={`${-d.half} ${-d.half} ${2 * d.half} ${2 * d.half}`} aria-hidden>
      <path d={d.path} fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Pick the meander pattern: a lattice (`tile` undefined) or an Ink/Stitch tile. */
export function MeanderPicker({ pattern, tile, onPick }: { pattern?: MeanderPattern; tile?: string; onPick: (p: { pattern?: MeanderPattern; tile?: string }) => void }) {
  const tiles = useTiles();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const cur: MeanderTile | undefined = tile ? tiles?.find((t) => t.id === tile) : LATTICES.find((l) => l.pattern === (pattern ?? "square"));
  return (
    <>
      <button type="button" ref={btn} className={`meander-pick ${open ? "on" : ""}`} title={t("filum.pannelli.meander_pattern_filum_lattices_and")} onClick={() => setOpen((v) => !v)}>
        {cur ? <TilePreview tile={cur} size={26} /> : <span className="tile-preview" style={{ width: 26, height: 26 }} />}
        <span className="mp-name">{tile ? `Ink/Stitch ${tile}` : (cur?.name ?? t("filum.pannelli.square"))}</span>
        <ChevronDown size={13} />
      </button>
      {open && btn.current && (
        <MeanderMenu
          anchor={btn.current}
          tiles={tiles ?? []}
          pattern={pattern}
          tile={tile}
          onPick={(p) => {
            onPick(p);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function MeanderMenu({
  anchor,
  tiles,
  pattern,
  tile,
  onPick,
  onClose,
}: {
  anchor: HTMLElement;
  tiles: MeanderTile[];
  pattern?: MeanderPattern;
  tile?: string;
  onPick: (p: { pattern?: MeanderPattern; tile?: string }) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState({ left: 0, top: 0, maxHeight: 420 });
  const mv = useMovable();
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const w = 336;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w));
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const maxHeight = Math.min(460, Math.max(below, above));
    const top = below >= Math.min(360, above) ? r.bottom + 4 : Math.max(8, r.top - 4 - maxHeight);
    setPos({ left, top, maxHeight });
  }, [anchor]);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key);
    };
  }, [anchor, onClose]);
  const s = q.trim().toLowerCase();
  const shown = tiles.filter((t) => !s || t.id.toLowerCase().includes(s) || t.name.toLowerCase().includes(s));
  const lattices = LATTICES.filter((l) => !s || l.name.toLowerCase().includes(s));
  return createPortal(
    <div className="meander-menu" ref={ref} style={{ ...pos, transform: mv.moved ? `translate(${mv.off[0]}px, ${mv.off[1]}px)` : undefined }} data-movable>
      <Grip grip={mv.grip} label={t("filum.pannelli.meander_pattern")} />
      <label className="chart-search">
        <Search size={13} />
        <input className="input" autoFocus placeholder={t("filum.pannelli.search_v1_patterns", { v1: tiles.length + LATTICES.length })} value={q} onChange={(e) => setQ(e.target.value)} />
        {q && (
          <button type="button" className="icon-btn" onClick={() => setQ("")} title={t("filum.pannelli.clear")}>
            <X size={12} />
          </button>
        )}
      </label>
      <div className="mm-scroll">
        {lattices.length > 0 && (
          <>
            <div className="cm-head">{t("filum.pannelli.lattices")}</div>
            <div className="mm-grid">
              {lattices.map((l) => (
                <button type="button" key={l.id} title={l.title} className={!tile && (pattern ?? "square") === l.pattern ? "on" : ""} onClick={() => onPick({ pattern: l.pattern, tile: undefined })}>
                  <TilePreview tile={l} />
                  <span>{l.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {shown.length > 0 && (
          <>
            <div className="cm-head">{t("filum.pannelli.ink_stitch_tiles_shown", { shown: shown.length })}</div>
            <div className="mm-grid">
              {shown.map((th) => (
                <button type="button" key={th.id} title={t("filum.pannelli.ink_stitch_meander_tile_name", { name: th.name })} className={tile === th.id ? "on" : ""} onClick={() => onPick({ tile: th.id })}>
                  <TilePreview tile={th} />
                  <span>{th.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {!shown.length && !lattices.length && <p className="hint" style={{ padding: "6px 10px" }}>{t("filum.pannelli.no_pattern_matches_q", { q })}</p>}
      </div>
    </div>,
    document.body,
  );
}
