//! Automatic appliqué: one object that sews the three steps of
//! an appliqué on its closed outline(s):
//!
//! 1. placement line (running stitch) → stop, the operator lays the fabric;
//! 2. tack-down (zig-zag, E-stitch or running stitch, slightly inside the
//!    edge) → stop, the operator trims the fabric along the stitching;
//! 3. cover stitch (satin or E-stitch / blanket) over the raw edge.
//!
//! Stops are emitted as one-point "command runs" flagged `STOP`, which the
//! assembler turns into tie-off + trim + machine stop.

use super::fill::fill_rings;
use super::running::running_stitch;
use super::satin::satin;
use super::Run;
use crate::geom::{offset_rings, point_in_ring, point_in_rings, rings_bounds, signed_area, Point, Ring};
use crate::model::{AppliqueParams, CoverKind, SatinMethod, SatinParams, SubPath, TackdownKind};
use crate::plan::flags;

pub use super::layered3d::{is_thread_switch as is_thread_change, thread_switch as thread_change};

/// NOVAstitch (Signor Poletti, 25/11): the placement line and the tack-down
/// are sewn in a thread of their own the program adds, «Appliqué», in a colour
/// the design does not use; the cover in the object's thread. The change of
/// thread after the tack-down stops every machine (in DST a stop and a colour
/// change are the same code, and a multi-needle machine goes on without
/// stopping when the next colour is on the same needle).
pub const APPLIQUE_THREAD_ID: &str = "nova.applique";
/// The colours the «Appliqué» thread can take, in order: the first the design does not use.
pub const APPLIQUE_COLORS: [&str; 8] = ["#9e9e9e", "#00a6a6", "#a600a6", "#a6a600", "#ff8c00", "#0066ff", "#66cc00", "#ff3399"];

/// The «Appliqué» thread of a design: a colour none of its threads has.
pub fn applique_thread(doc: &crate::model::Document) -> crate::model::Thread {
    let used = |c: &str| doc.threads.iter().any(|t| t.color.eq_ignore_ascii_case(c));
    let color = APPLIQUE_COLORS
        .iter()
        .map(|c| c.to_string())
        .find(|c| !used(c))
        // every one used: a grey no thread has
        .or_else(|| (0..=255u32).rev().map(|v| format!("#{v:02x}{v:02x}{:02x}", v ^ 1)).find(|c| !used(c)))
        .unwrap_or_else(|| APPLIQUE_COLORS[0].into());
    crate::model::Thread { id: APPLIQUE_THREAD_ID.into(), name: "Appliqué".into(), color, brand: String::new(), code: String::new(), weight: None }
}

/// One-point run asking the assembler for a trim + machine stop here.
pub fn stop_here(at: Point) -> Run {
    vec![(at, flags::STOP)]
}

pub fn is_stop(run: &Run) -> bool {
    run.len() == 1 && run[0].1 & flags::STOP != 0
}

/// Outer rings counter-clockwise, holes clockwise (consistent rail sides).
fn oriented(rings: Vec<Ring>) -> Vec<Ring> {
    let all = rings.clone();
    rings
        .into_iter()
        .enumerate()
        .map(|(i, mut r)| {
            let depth = all.iter().enumerate().filter(|(j, o)| *j != i && point_in_ring(r[0], o)).count();
            if (signed_area(&r) > 0.0) != (depth % 2 == 0) {
                r.reverse();
            }
            r
        })
        .collect()
}

fn closed(r: &Ring) -> Vec<Point> {
    let mut v = r.clone();
    v.push(r[0]);
    v
}

fn as_paths(rings: &[Ring]) -> Vec<SubPath> {
    rings.iter().map(|r| SubPath::polyline(r, true)).collect()
}

/// Satin / zig-zag / E-stitch along rings. E-stitch keeps its baseline
/// outside the `outside_of` region (blanket stitch on the fabric edge, prongs
/// pointing into the appliqué) unless `flip`.
fn column(rings: &[Ring], p: SatinParams, extra_pull: f64, density: f64, outside_of: &[Ring], flip: bool) -> Vec<Run> {
    let mut runs = satin(&as_paths(rings), &p, extra_pull, density);
    if p.method == SatinMethod::EStitch {
        let base_inside = runs
            .iter()
            .filter_map(|r| r.iter().find(|x| x.1 & flags::UNDERLAY == 0))
            .next()
            .map(|x| point_in_rings(x.0, outside_of))
            .unwrap_or(false);
        if base_inside != flip {
            runs = satin(&as_paths(rings), &SatinParams { swap_rails: !p.swap_rails, ..p }, extra_pull, density);
        }
    }
    runs
}

pub fn applique(paths: &[SubPath], p: &AppliqueParams, extra_pull: f64, density: f64) -> Vec<Run> {
    let rings = fill_rings(paths);
    if rings.is_empty() {
        return vec![];
    }
    let rings = oriented(rings);
    let b = rings_bounds(&rings);
    let res = (b.width().max(b.height()) / 1500.0).clamp(0.03, 0.15);
    let mut runs: Vec<Run> = Vec::new();
    let last = |runs: &Vec<Run>| runs.last().and_then(|r| r.last()).map(|x| x.0);

    // 1. placement line (NOVAstitch: inside the edge; free edge 5 mm inside)
    let inset = if p.free_edge { crate::model::APPLIQUE_FREE_EDGE_INSET } else { within(p.placement_inset, 0.0, MAX_WIDTH, 0.0) };
    let placed = if inset > 1e-6 { oriented(offset_rings(&rings, -inset, res)) } else { rings.clone() };
    let placed = if placed.is_empty() { rings.clone() } else { placed };
    let tackdown = if p.free_edge { TackdownKind::None } else { p.tackdown };
    if p.placement {
        for r in &placed {
            let s = running_stitch(&closed(r), p.placement_length.max(0.5), 0.1);
            runs.push(s.into_iter().map(|q| (q, 0u8)).collect());
        }
        // a stop before the tack-down (before the cover, the change of thread below)
        if p.stops && tackdown != TackdownKind::None {
            if let Some(at) = last(&runs) {
                runs.push(stop_here(at));
            }
        }
    }

    // 2. tack-down, a little inside the edge
    let tack = if p.tackdown_inset > 1e-6 { oriented(offset_rings(&rings, -within(p.tackdown_inset, 0.0, MAX_WIDTH, 0.0), res)) } else { rings.clone() };
    let tack = if tack.is_empty() { rings.clone() } else { tack };
    match tackdown {
        TackdownKind::None => {}
        TackdownKind::Run => {
            for r in &tack {
                let s = running_stitch(&closed(r), 2.0, 0.1);
                runs.push(s.into_iter().map(|q| (q, 0u8)).collect());
            }
        }
        TackdownKind::Zigzag | TackdownKind::EStitch => {
            let sp = SatinParams {
                method: if tackdown == TackdownKind::Zigzag { SatinMethod::Zigzag } else { SatinMethod::EStitch },
                width: within(p.tackdown_width, 0.3, MAX_WIDTH, 1.6),
                spacing: within(p.tackdown_spacing, 0.3, MAX_WIDTH, 1.2),
                pull_comp: 0.0,
                short_stitch_inset: 0.0,
                center_walk: false,
                multi: true,
                ..Default::default()
            };
            runs.extend(column(&tack, sp, 0.0, 1.0, &rings, p.flip));
        }
    }
    // before the cover: trim and the object's own thread (placement and tack-down were in «Appliqué»)
    if p.stops && p.cover != CoverKind::None {
        if let Some(at) = last(&runs) {
            runs.push(thread_change(at));
        }
    }

    // 3. cover stitch over the raw edge
    if p.cover != CoverKind::None {
        let cover = if p.cover_offset.abs() > 1e-6 { oriented(offset_rings(&rings, within(p.cover_offset, -MAX_WIDTH, MAX_WIDTH, 0.0), res)) } else { rings.clone() };
        let cover = if cover.is_empty() { rings.clone() } else { cover };
        let sp = SatinParams {
            method: if p.cover == CoverKind::Satin { SatinMethod::Satin } else { SatinMethod::EStitch },
            width: within(p.cover_width, 0.5, MAX_WIDTH, 3.0),
            spacing: within(p.cover_spacing, 0.15, MAX_WIDTH, 0.4),
            pull_comp: p.pull_comp,
            center_walk: p.cover_underlay,
            multi: true,
            ..Default::default()
        };
        runs.extend(column(&cover, sp, extra_pull, density, &rings, p.flip));
    }
    runs.retain(|r| !r.is_empty());
    runs
}

/// Widest tack-down / cover column and furthest inset or offset (mm): far
/// beyond any appliqué edge, and a 1e5 mm column would take forever.
const MAX_WIDTH: f64 = 20.0;

/// `v` brought into `lo..=hi` (`fallback` when it is not a number).
fn within(v: f64, lo: f64, hi: f64, fallback: f64) -> f64 {
    if v.is_finite() { v.clamp(lo, hi) } else if v.is_nan() { fallback } else if v > 0.0 { hi } else { lo }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::geom::pt;

    /// Filum's appliqué (a file without the new fields).
    fn filum() -> AppliqueParams {
        serde_json::from_str("{}").unwrap()
    }

    fn square() -> Vec<SubPath> {
        vec![SubPath::polyline(&[pt(0.0, 0.0), pt(30.0, 0.0), pt(30.0, 30.0), pt(0.0, 30.0)], true)]
    }

    #[test]
    fn three_steps_a_stop_and_a_thread_change() {
        // NOVAstitch (Signor Poletti, 25/11): a stop after the placement, the
        // appliqué's own thread changed for the object's after the tack-down
        let runs = applique(&square(), &filum(), 0.0, 1.0);
        assert_eq!(runs.iter().filter(|r| is_stop(r)).count(), 1);
        assert_eq!(runs.iter().filter(|r| is_thread_change(r)).count(), 1);
        // placement first, cover last; cover stitches straddle the edge
        let first = &runs[0];
        assert!(first.iter().all(|x| x.0.x.abs() < 1e-6 || (x.0.x - 30.0).abs() < 1e-6 || x.0.y.abs() < 1e-6 || (x.0.y - 30.0).abs() < 1e-6));
        let cover = runs.last().unwrap();
        let outside = cover.iter().filter(|x| x.0.x < -0.5 || x.0.x > 30.5 || x.0.y < -0.5 || x.0.y > 30.5).count();
        assert!(outside > 50, "cover reaches outside the edge: {outside}");
    }

    #[test]
    fn no_stops_when_disabled() {
        let p = AppliqueParams { stops: false, ..Default::default() };
        let runs = applique(&square(), &p, 0.0, 1.0);
        assert_eq!(runs.iter().filter(|r| is_stop(r) || is_thread_change(r)).count(), 0, "no stop, no thread change: all in the object's thread");
    }

    #[test]
    fn blanket_baseline_outside() {
        let p = AppliqueParams { cover: CoverKind::EStitch, tackdown: TackdownKind::None, placement: false, ..Default::default() };
        let runs = applique(&square(), &p, 0.0, 1.0);
        let base = runs[0].iter().find(|x| x.1 & flags::UNDERLAY == 0).unwrap().0;
        let r = [vec![pt(0.0, 0.0), pt(30.0, 0.0), pt(30.0, 30.0), pt(0.0, 30.0)]];
        assert!(!point_in_rings(base, &r), "baseline {base:?} outside");
    }

    /// Distance of a point to the square's edge (positive inside).
    fn inside_by(q: Point) -> f64 {
        let r = [vec![pt(0.0, 0.0), pt(30.0, 0.0), pt(30.0, 30.0), pt(0.0, 30.0)]];
        let d = crate::geom::dist_to_boundary(&r, q);
        if point_in_rings(q, &r) { d } else { -d }
    }

    /// The runs between the stops and the thread change: one group per step.
    fn steps(runs: &[Run]) -> Vec<Vec<&Run>> {
        let mut out = vec![vec![]];
        for r in runs {
            if is_stop(r) || is_thread_change(r) {
                out.push(vec![]);
            } else {
                out.last_mut().unwrap().push(r);
            }
        }
        out
    }

    #[test]
    fn j9_new_applique_defaults() {
        // NOVAstitch j.9 (Punch, decisions of 12/11 and 24/11): placement 1.25 mm
        // inside, straight-stitch tack-down 2 mm inside the edge, 4.5 mm satin
        // cover on the edge that hides the tack-down
        let p = AppliqueParams::default();
        assert_eq!(p.tackdown, TackdownKind::Run);
        let runs = applique(&square(), &p, 0.0, 1.0);
        let s = steps(&runs);
        assert_eq!(s.len(), 3, "placement, tack-down, cover");
        assert!(is_stop(runs.iter().find(|r| is_stop(r) || is_thread_change(r)).unwrap()), "after the placement: a stop");
        for x in s[0].iter().flat_map(|r| r.iter()) {
            assert!((inside_by(x.0) - 1.25).abs() < 0.05, "placement {:?} at {}", x.0, inside_by(x.0));
        }
        for x in s[1].iter().flat_map(|r| r.iter()) {
            assert!(inside_by(x.0) >= 2.0 - 0.05, "tack-down {:?} at {}", x.0, inside_by(x.0));
        }
        let cover: Vec<f64> = s[2].iter().flat_map(|r| r.iter()).filter(|x| x.1 & flags::UNDERLAY == 0).map(|x| inside_by(x.0)).collect();
        let (lo, hi) = cover.iter().fold((f64::MAX, f64::MIN), |(a, b), v| (a.min(*v), b.max(*v)));
        // (outside, the corners reach further: √2 · 2.25)
        assert!((hi - 2.25).abs() < 0.1 && lo <= -2.2, "cover from {lo} to {hi}");
        assert!(hi > 2.0, "the cover hides the tack-down");
    }

    #[test]
    fn j10_free_edge() {
        // NOVAstitch j.10: placement 5 mm inside, stop (spray glue and fabric), cover; no tack-down.
        // The stop is the change to the object's thread (25/11): every machine stops there
        let p = AppliqueParams { free_edge: true, ..Default::default() };
        let runs = applique(&square(), &p, 0.0, 1.0);
        let s = steps(&runs);
        assert_eq!(s.len(), 2, "placement, stop, cover: {}", s.len());
        assert_eq!((runs.iter().filter(|r| is_stop(r)).count(), runs.iter().filter(|r| is_thread_change(r)).count()), (0, 1));
        for x in s[0].iter().flat_map(|r| r.iter()) {
            assert!((inside_by(x.0) - 5.0).abs() < 0.05, "placement {:?} at {}", x.0, inside_by(x.0));
        }
        assert!(s[1].iter().flat_map(|r| r.iter()).any(|x| inside_by(x.0) < -1.0), "the cover straddles the edge");
    }

    #[test]
    fn files_without_the_new_fields_read_as_before() {
        // a Filum appliqué without placementInset / freeEdge (and without the
        // fields whose defaults changed) sews as Filum sewed it
        let p: AppliqueParams = serde_json::from_str("{}").unwrap();
        assert_eq!(p.placement_inset, 0.0);
        assert!(!p.free_edge);
        assert_eq!(p.tackdown, TackdownKind::Zigzag);
        assert_eq!(p.tackdown_inset, 0.6);
        assert_eq!(p.cover_width, 3.0);
        let runs = applique(&square(), &p, 0.0, 1.0);
        assert!(runs[0].iter().all(|x| inside_by(x.0).abs() < 1e-6), "placement on the edge");
    }

    /// DST records after the header: (kind, dx, dy) with kind 'S' stitch, 'J' jump, 'C' colour change, 'E' end.
    fn dst_records(bytes: &[u8]) -> Vec<char> {
        bytes[512..]
            .chunks_exact(3)
            .map(|r| match r[2] {
                0xF3 => 'E',
                c if c & 0xC3 == 0xC3 => 'C',
                c if c & 0x83 == 0x83 => 'J',
                _ => 'S',
            })
            .take_while(|k| *k != 'E')
            .collect()
    }

    #[test]
    fn j13_trim_and_stop_after_the_placement_trim_and_thread_change_after_the_tackdown() {
        // NOVAstitch j.13 (Signor Poletti, 25/11): placement and tack-down in the
        // «Appliqué» thread the program adds (a colour the design does not use),
        // the cover in the object's thread; trim + stop after the placement,
        // trim + colour change after the tack-down, so every machine stops
        use crate::assemble::Engine;
        use crate::model::{Document, Object, StitchParams, Thread};
        let mut o: Object = serde_json::from_value(serde_json::json!({ "id": "a", "thread": "t", "paths": [] })).unwrap();
        o.paths = square();
        o.stitch = StitchParams::Applique(AppliqueParams::default());
        // the design's thread takes the first colour the appliqué thread would pick
        let t = Thread { id: "t".into(), name: "Rosso".into(), color: APPLIQUE_COLORS[0].to_uppercase(), brand: "".into(), code: "".into(), weight: None };
        let d = Document { threads: vec![t], objects: vec![o], ..Default::default() };
        let plan = Engine::new().plan(&d);
        // the threads: «Appliqué» in a colour the design does not use, then the object's
        assert_eq!(plan.threads.len(), 2);
        assert_eq!((plan.threads[0].id.as_str(), plan.threads[0].name.as_str()), (APPLIQUE_THREAD_ID, "Appliqué"));
        assert!(!plan.threads[0].color.eq_ignore_ascii_case(APPLIQUE_COLORS[0]) && plan.threads[0].color == APPLIQUE_COLORS[1], "not a colour of the design: {}", plan.threads[0].color);
        assert_eq!(plan.threads[1].id, "t");
        // the commands in the plan, in order
        let cmds: Vec<u8> = plan.stitches.iter().map(|s| s.flags & (flags::TRIM | flags::STOP | flags::COLOR_CHANGE)).filter(|f| *f != 0).collect();
        assert_eq!(cmds, [flags::TRIM, flags::STOP, flags::TRIM, flags::COLOR_CHANGE, flags::TRIM], "trim + stop, trim + colour change, the final trim");
        let at = |f: u8| plan.stitches.iter().position(|s| s.is(f)).unwrap();
        assert_eq!(plan.stitches[at(flags::STOP) - 1].flags & flags::TRIM, flags::TRIM, "the stop right after a trim");
        assert_eq!(plan.stitches[at(flags::COLOR_CHANGE) - 1].flags & flags::TRIM, flags::TRIM, "the colour change right after a trim");
        // the placement before the stop, the tack-down between, the cover after the colour change
        let needles = |a: usize, b: usize| plan.stitches[a..b].iter().filter(|s| s.flags & flags::COMMANDS == 0).map(|s| inside_by(pt(s.x, s.y))).collect::<Vec<_>>();
        assert!(needles(0, at(flags::STOP)).iter().filter(|v| (**v - 1.25).abs() < 0.05).count() > 20, "the placement before the stop");
        assert!(needles(at(flags::STOP), at(flags::COLOR_CHANGE)).iter().all(|v| *v >= 2.0 - 0.05), "only the tack-down between");
        assert!(needles(at(flags::COLOR_CHANGE), plan.stitches.len()).iter().any(|v| *v < -1.0), "the cover after the colour change");
        // the DST: a trim (jumps that do not move) then the stop code, twice; in DST a stop is a colour change
        let dst = crate::io::export_with(&d, &mut Engine::new(), "dst", &Default::default()).unwrap();
        let k: String = dst_records(&dst).into_iter().collect();
        let blocks: Vec<&str> = k.split('C').collect();
        assert_eq!(blocks.len(), 3, "two stop codes: {}", k.len());
        for b in &blocks[..2] {
            assert!(b.ends_with("JJJ") && b.contains('S'), "a trim right before the stop code");
        }
        let header = String::from_utf8_lossy(&dst[..512]).to_string();
        assert!(header.contains("CO:  2"), "two colour changes in the header");
    }
}
