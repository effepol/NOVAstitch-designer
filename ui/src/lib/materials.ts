// Materials: fabrics with the stabiliser and needle their makers recommend,
// and thread weights with spacing, needle and the smallest lettering.
//
// Sources (manufacturer guides):
// - Stabilisers: OESD Stabilizer Guide, Floriani Stabilizer Recommendation,
//   Madeira FAQ + backing selector ("cut-away for flexible fabrics, tear-away
//   for strong ones; a thin topping on terry, T-shirts, piqué and knits").
// - Needles: SCHMETZ Embroidery (01/2024), Groz-Beckert embroidery needles,
//   Organ needle size chart.
// - Thread: Madeira USA "Threads & Digitizing" (stitch density guide, needle
//   per thread), Madeira Polyneon / Classic pages (smallest lettering), Melco
//   small-lettering guide (0.20″ / 0.25″ on caps).
// Where makers disagree or none publishes a value, the entry says so.

import type { Fabric, Hoop, ThreadWeight } from "../types";
import { t } from "../nova/i18n/filum";

export type Confidence = "agreed" | "conflict" | "inferred";

export interface FabricInfo {
  id: Fabric;
  label: string;
  /** What the fabric preset does to the stitches (Settings ▸ fabric profile). */
  effect: string;
  backing: string;
  topping: string;
  needle: string;
  /** Do the makers agree? */
  confidence: Confidence;
  note?: string;
}

export const FABRICS: FabricInfo[] = [
  {
    id: "cotton",
    get label() { return t("filum.dati.cotton"); },
    get effect() { return t("filum.dati.standard_settings"); },
    get backing() { return t("filum.dati.tear_away_cut_away_for"); },
    get topping() { return t("filum.dati.none"); },
    get needle() { return t("filum.dati.sharp_75_11"); },
    confidence: "agreed",
  },
  {
    id: "polyester",
    get label() { return t("filum.dati.polyester"); },
    get effect() { return t("filum.dati.standard_settings"); },
    get backing() { return t("filum.dati.tear_away_cut_away_for_2"); },
    get topping() { return t("filum.dati.none"); },
    get needle() { return t("filum.dati.sharp_microtex_65_9_75"); },
    confidence: "inferred",
    get note() { return t("filum.dati.no_maker_lists_woven_polyester"); },
  },
  {
    id: "denim",
    get label() { return t("filum.dati.denim"); },
    get effect() { return t("filum.dati.wider_spacing_denim_heavy_twill"); },
    get backing() { return t("filum.dati.tear_away_madeira_floriani_or"); },
    get topping() { return t("filum.dati.none"); },
    get needle() { return t("filum.dati.sharp_80_12_90_14"); },
    confidence: "conflict",
    get note() { return t("filum.dati.the_makers_disagree_on_the"); },
  },
  {
    id: "knit",
    get label() { return t("filum.dati.knit_jersey"); },
    get effect() { return t("filum.dati.slightly_looser_underlay_always_on"); },
    get backing() { return t("filum.dati.cut_away_no_show_mesh"); },
    get topping() { return t("filum.dati.water_soluble_film"); },
    get needle() { return t("filum.dati.ballpoint_70_10_75_11"); },
    confidence: "agreed",
  },
  {
    id: "pique",
    get label() { return t("filum.dati.pique_polo"); },
    get effect() { return t("filum.dati.slightly_looser_extra_edge_zigzag"); },
    get backing() { return t("filum.dati.light_cut_away_mesh"); },
    get topping() { return t("filum.dati.water_soluble_film_keeps_stitches"); },
    get needle() { return t("filum.dati.ballpoint_70_10_75_11"); },
    confidence: "agreed",
  },
  {
    id: "fleece",
    get label() { return t("filum.dati.fleece"); },
    get effect() { return t("filum.dati.wider_spacing_heavy_underlay"); },
    get backing() { return t("filum.dati.heavy_cut_away"); },
    get topping() { return t("filum.dati.water_soluble_film_or_a"); },
    get needle() { return t("filum.dati.ballpoint_75_11"); },
    confidence: "agreed",
  },
  {
    id: "towel",
    get label() { return t("filum.dati.towel_terry"); },
    get effect() { return t("filum.dati.denser_underlay_always_on"); },
    get backing() { return t("filum.dati.tear_away"); },
    get topping() { return t("filum.dati.water_soluble_film_essential_or"); },
    needle: "75/11",
    confidence: "agreed",
  },
  {
    id: "sheer",
    get label() { return t("filum.dati.organza_sheer"); },
    get effect() { return t("filum.dati.lighter_density_and_underlay"); },
    get backing() { return t("filum.dati.wash_away_fibrous_or_film"); },
    get topping() { return t("filum.dati.optional_water_soluble_film"); },
    get needle() { return t("filum.dati.ballpoint_fine_65_9"); },
    confidence: "agreed",
  },
  {
    id: "silk",
    get label() { return t("filum.dati.silk_satin"); },
    get effect() { return t("filum.dati.less_density_minimal_underlay"); },
    get backing() { return t("filum.dati.fusible_woven_interfacing_tear_away"); },
    get topping() { return t("filum.dati.optional_water_soluble_film"); },
    get needle() { return t("filum.dati.fine_sharp_microtex_65_9"); },
    confidence: "agreed",
  },
  {
    id: "canvas",
    get label() { return t("filum.dati.canvas"); },
    get effect() { return t("filum.dati.wider_spacing"); },
    get backing() { return t("filum.dati.tear_away"); },
    get topping() { return t("filum.dati.none"); },
    get needle() { return t("filum.dati.sharp_80_12"); },
    confidence: "agreed",
  },
  {
    id: "leather",
    get label() { return t("filum.dati.leather_vinyl"); },
    get effect() { return t("filum.dati.lower_density_minimal_underlay_every"); },
    get backing() { return t("filum.dati.sticky_cut_away_floated_instead"); },
    get topping() { return t("filum.dati.none"); },
    get needle() { return t("filum.dati.sharp_75_11_90_14"); },
    confidence: "conflict",
    get note() { return t("filum.dati.makers_disagree_on_cutting_wedge"); },
  },
  {
    id: "felt",
    get label() { return t("filum.dati.felt"); },
    get effect() { return t("filum.dati.slightly_lighter_density_and_underlay"); },
    get backing() { return t("filum.dati.tear_away"); },
    get topping() { return t("filum.dati.none"); },
    get needle() { return t("filum.dati.sharp_75_11"); },
    confidence: "inferred",
    get note() { return t("filum.dati.no_stabiliser_maker_gives_felt"); },
  },
  {
    id: "cap",
    get label() { return t("filum.dati.cap_structured"); },
    get effect() { return t("filum.dati.underlay_always_on"); },
    get backing() { return t("filum.dati.cap_tear_away"); },
    get topping() { return t("filum.dati.optional"); },
    get needle() { return t("filum.dati.sharp_75_11_80_12"); },
    confidence: "agreed",
  },
];

export const fabricInfo = (f: Fabric) => FABRICS.find((x) => x.id === f) ?? FABRICS[0];

export interface ThreadWeightInfo {
  weight: ThreadWeight;
  label: string;
  /** Satin spacing for this weight (mm) — the density guide's value. */
  spacing: number;
  needle: string;
  /** Smallest lettering (cap height, mm). */
  minText: number;
  minTextSource: string;
  /** Linear density (tex): Madeira Polyneon data sheets (75 / 60 / 40), Schmetz's table for No. 30 / 12. */
  tex: number;
}

export const THREAD_WEIGHTS: ThreadWeightInfo[] = [
  { weight: 75, get label() { return t("filum.dati.no_75_extra_fine"); }, spacing: 0.2, needle: "60/8", minText: 2.5, minTextSource: "Madeira Polyneon 75", tex: 11 },
  { weight: 60, get label() { return t("filum.dati.no_60_fine"); }, spacing: 0.35, needle: "60/8–65/9", minText: 3, minTextSource: "Madeira Polyneon / Classic 60", tex: 17 },
  { weight: 40, get label() { return t("filum.dati.no_40_standard"); }, spacing: 0.4, needle: "65/9–75/11", minText: 5, minTextSource: "Melco small-lettering guide (6.4 mm on caps)", tex: 27 },
  { weight: 30, get label() { return t("filum.dati.no_30_heavy"); }, spacing: 0.5, needle: "75/11–80/12", minText: 6.3, minTextSource: "no published minimum — scaled from No. 40 by the spacing", tex: 40 },
  { weight: 12, get label() { return t("filum.dati.no_12_very_heavy"); }, spacing: 0.8, needle: "100/16", minText: 10, minTextSource: "no published minimum — scaled from No. 40 by the spacing", tex: 100 },
];

/**
 * How wide a stitch of this thread lies on the fabric (mm): 0.4 mm for No. 40
 * (the standard satin spacing, where neighbouring stitches just touch),
 * scaled with the thread's diameter, which grows with √tex.
 */
export const threadWidth = (w: ThreadWeight | undefined) => 0.4 * Math.sqrt(threadWeightInfo(w).tex / 27);

/**
 * How glossy a thread looks (0 matte … 1 rayon, > 1 metallic), from its brand
 * and name: rayon shines most, polyester a little less, cotton is matte.
 */
export function threadSheen(t: { brand?: string; name?: string } | undefined): number {
  const s = `${t?.brand ?? ""} ${t?.name ?? ""}`.toLowerCase();
  if (/metal|gold|silver|glitter|supertwist|lamé|lame|holo/.test(s)) return 1.4;
  if (/dmc|cotton|cotona|cotone|mako|aurifil|gütermann|gutermann|anchor|wool|burmilana|frosted|matt/.test(s)) return 0.25;
  if (/rayon|classic|sulky|marathon|robison|viscose/.test(s)) return 1;
  return 0.8; // polyester: Isacord, Polyneon, Brother, Floriani, Simthread …
}

export const threadWeightInfo = (w: ThreadWeight | undefined) => THREAD_WEIGHTS.find((x) => x.weight === (w ?? 40)) ?? THREAD_WEIGHTS[2];

// ---- hoop shapes ------------------------------------------------------------

/** Is the point (mm, document coordinates) inside the hoop? */
export function inHoop(hoop: Hoop, x: number, y: number, tol = 0.01): boolean {
  if (hoop.shape !== "oval") return x >= -tol && y >= -tol && x <= hoop.width + tol && y <= hoop.height + tol;
  const rx = hoop.width / 2 + tol;
  const ry = hoop.height / 2 + tol;
  const dx = (x - hoop.width / 2) / rx;
  const dy = (y - hoop.height / 2) / ry;
  return dx * dx + dy * dy <= 1;
}

/** How far outside an ellipse a point is, as the ellipse's own measure (≤ 1 = inside). */
export function ovalNorm(cx: number, cy: number, w: number, h: number, x: number, y: number): number {
  const dx = (x - cx) / (w / 2);
  const dy = (y - cy) / (h / 2);
  return Math.sqrt(dx * dx + dy * dy);
}

/** "oval" or "round" for the UI. */
export const shapeLabel = (h: { width: number; height: number; shape?: string }) =>
  h.shape === "oval" ? (Math.abs(h.width - h.height) < 0.01 ? "round" : "oval") : "rectangle";
