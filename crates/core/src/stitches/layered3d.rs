//! NOVAstitch (module j): layered 3D (Punch; contract, module j; Signor
//! Poletti, 24/11).
//!
//! From a satin column the program makes the inner layers by itself, growing:
//! first the core (the narrowest layer, over two underlay layers — the zig-zag
//! there and back — and a contour), then the wider layers, and last the layer
//! that wraps them all: the column itself. 2 to 4 inner layers plus the final one.
//!
//! The edges are staggered: each inner layer is `shrink_per_layer` narrower
//! than the next (half of it on each side), so no needle point of a layer falls
//! within 0.3 mm (provisional) of one of the layer before — in the same holes
//! the thread would break.
//!
//! The inner layers are sewn with the thread the operator chooses
//! (`base_thread`, the one in the machine: polyester under a metallic): a
//! one-point run flagged `COLOR_CHANGE` before the final layer asks the
//! assembler for the object's own thread there.

use super::satin::{plot_points_on_rails, satin_geometry, satin_on};
use super::Run;
use crate::geom::Point;
use crate::model::{Document, FabricProfile, Layered3dParams, Object, SatinParams, StitchParams, SubPath, LAYERED3D_MAX_LAYERS, LAYERED3D_MIN_LAYERS, LAYERED3D_SHRINK};
use crate::plan::flags;

/// A layer narrower than this is left out (mm): nothing to sew.
const MIN_LAYER_WIDTH: f64 = 0.5;

/// One-point run: from here on the object's own thread (the final layer).
pub fn thread_switch(at: Point) -> Run {
    vec![(at, flags::COLOR_CHANGE)]
}

pub fn is_thread_switch(run: &Run) -> bool {
    run.len() == 1 && run[0].1 & flags::COLOR_CHANGE != 0
}

/// The thread an object starts with: a layered 3D's base thread when the design has it, else its own.
pub fn start_thread<'a>(obj: &'a Object, doc: &Document) -> &'a str {
    match &obj.stitch {
        StitchParams::Layered3d(p) => p.base_thread.as_deref().filter(|t| doc.thread(t).is_some()).unwrap_or(&obj.thread),
        _ => &obj.thread,
    }
}

/// The column's (narrowest, for several sub-paths) mean width.
fn width(paths: &[SubPath], p: &SatinParams) -> f64 {
    let groups: Vec<Vec<SubPath>> = if p.multi && paths.len() > 1 { paths.iter().map(|s| vec![s.clone()]).collect() } else { vec![paths.to_vec()] };
    let single = SatinParams { multi: false, ..p.clone() };
    groups
        .iter()
        .filter_map(|g| {
            let pairs = plot_points_on_rails(&satin_geometry(g, &single)?, 0.5, 0.0, 0.0);
            (!pairs.is_empty()).then(|| pairs.iter().map(|(a, b)| a.dist(*b)).sum::<f64>() / pairs.len() as f64)
        })
        .fold(f64::INFINITY, f64::min)
}

pub fn layered3d(paths: &[SubPath], p: &Layered3dParams, fabric: &FabricProfile) -> Vec<Run> {
    let n = p.layers.clamp(LAYERED3D_MIN_LAYERS, LAYERED3D_MAX_LAYERS);
    let shrink = if p.shrink_per_layer.is_finite() && p.shrink_per_layer >= 0.0 { p.shrink_per_layer } else { LAYERED3D_SHRINK };
    let w = width(paths, &p.satin);
    if !w.is_finite() {
        return vec![];
    }
    // every layer: the column's satin, no underlay of its own
    let plain = SatinParams { underlay_auto: false, center_walk: false, contour_underlay: false, zigzag_underlay: false, foam: None, ..p.satin.clone() };
    let mut runs: Vec<Run> = Vec::new();
    let mut core = true;
    let mut reverse = p.satin.reverse;
    for k in 1..=n {
        // narrower by `inset` in all (half each side) than the column
        let inset = (n - k + 1) as f64 * shrink;
        if w + p.satin.pull_comp - inset < MIN_LAYER_WIDTH {
            continue;
        }
        let mut sp = SatinParams { pull_comp: p.satin.pull_comp - inset, reverse, ..plain.clone() };
        if let Some(sr) = sp.second_rail.as_mut() {
            sr.pull_comp = sr.pull_comp.map(|c| c - inset);
        }
        if std::mem::replace(&mut core, false) {
            // the core: contour and zig-zag (there and back: two layers) inside it
            sp.contour_underlay = true;
            sp.contour_underlay_repeats = 1;
            sp.zigzag_underlay = true;
            sp.zigzag_underlay_spacing = p.underlay_zigzag_spacing;
            sp.contour_inset = p.satin.contour_inset + inset / 2.0;
            sp.zigzag_underlay_inset = p.satin.zigzag_underlay_inset + inset / 2.0;
            sp.contour_inset_pct = 0.0;
            sp.zigzag_inset_pct = 0.0;
            sp.second_rail = sp.second_rail.map(|sr| crate::model::SecondRail { contour_inset: None, contour_inset_pct: None, zigzag_underlay_inset: None, zigzag_inset_pct: None, ..sr });
        }
        runs.extend(satin_on(paths, &sp, fabric));
        // each layer starts where the last one ended
        reverse = !reverse;
    }
    // the final layer, the whole column, in the object's own thread
    let last = SatinParams { reverse, ..plain };
    let wrap = satin_on(paths, &last, fabric);
    if let Some(at) = wrap.first().and_then(|r| r.first()).map(|x| x.0) {
        runs.push(thread_switch(at));
    }
    runs.extend(wrap);
    runs.retain(|r| !r.is_empty());
    runs
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::assemble::Engine;
    use crate::geom::pt;
    use crate::model::*;

    fn line(a: Point, b: Point) -> SubPath {
        SubPath::polyline(&[a, b], false)
    }
    fn column(width: f64, layers: u32) -> Layered3dParams {
        Layered3dParams { satin: SatinParams { width, ..Default::default() }, layers, ..Default::default() }
    }
    fn obj(id: &str, thread: &str, paths: Vec<SubPath>, stitch: StitchParams) -> Object {
        let mut o: Object = serde_json::from_value(serde_json::json!({ "id": id, "thread": thread, "paths": [] })).unwrap();
        o.paths = paths;
        o.stitch = stitch;
        o
    }
    fn thread(id: &str) -> Thread {
        // each its own colour (threads of one colour share a spool)
        let color = format!("#{:06x}", id.bytes().fold(7u32, |h, c| h.wrapping_mul(31).wrapping_add(c as u32)) & 0xff_ffff);
        Thread { id: id.into(), name: id.into(), color, brand: "".into(), code: "".into(), weight: None }
    }
    fn doc(objects: Vec<Object>, threads: &[&str]) -> Document {
        Document { threads: threads.iter().map(|t| thread(t)).collect(), objects, ..Default::default() }
    }

    #[test]
    fn j6_four_layers_and_the_final_one_staggered() {
        // NOVAstitch j.6 (24/11): a 12 mm shape, 4 layers → 4 layers and the final
        // one; no point of a layer within 0.3 mm of a point of the layer before
        let runs = layered3d(&[line(pt(0.0, 0.0), pt(40.0, 0.0))], &column(12.0, 4), &Fabric::Cotton.profile());
        let layers: Vec<&Run> = runs.iter().filter(|r| !is_thread_switch(r)).collect();
        assert_eq!(layers.len(), 5, "4 inner layers and the final one");
        assert_eq!(runs.iter().filter(|r| is_thread_switch(r)).count(), 1);
        // growing: the edges at 4.8, 5.1, 5.4, 5.7 and 6 mm from the centre line
        let edge = |r: &Run| r.iter().filter(|x| x.1 & flags::UNDERLAY == 0).map(|x| x.0.y.abs()).fold(0.0, f64::max);
        let edges: Vec<f64> = layers.iter().map(|r| edge(r)).collect();
        for (e, want) in edges.iter().zip([4.8, 5.1, 5.4, 5.7, 6.0]) {
            assert!((e - want).abs() < 1e-6, "edges {edges:?}");
        }
        // only the core has underlay (contour and zig-zag), inside it
        assert!(layers[0].iter().any(|x| x.1 & flags::UNDERLAY != 0) && layers[1..].iter().all(|r| r.iter().all(|x| x.1 & flags::UNDERLAY == 0)));
        assert!(layers[0].iter().filter(|x| x.1 & flags::UNDERLAY != 0).all(|x| x.0.y.abs() < 4.8 - 0.3));
        for k in 1..layers.len() {
            let min = layers[k].iter().flat_map(|a| layers[k - 1].iter().map(move |b| a.0.dist(b.0))).fold(f64::INFINITY, f64::min);
            assert!(min >= LAYERED3D_MIN_GAP - 1e-9, "layer {} to layer {}: {min} mm", k + 1, k);
        }
        // each layer starts near where the last one ended
        for k in 1..layers.len() {
            let (a, b) = (layers[k - 1].last().unwrap().0, layers[k].first().unwrap().0);
            assert!(a.dist(b) < 13.0, "layer {} starts {} mm away", k + 1, a.dist(b));
        }
    }

    #[test]
    fn j12_five_layers_are_refused() {
        // NOVAstitch j.12 (24/11): layers = 5 → refused, 4 at most (and 2 at least)
        let read = |n: u32| serde_json::from_value::<StitchParams>(serde_json::json!({ "type": "layered3d", "layers": n }));
        let err = read(5).unwrap_err().to_string();
        assert!(err.contains("layers 5"), "{err}");
        assert!(read(1).is_err());
        assert!(matches!(read(4).unwrap(), StitchParams::Layered3d(Layered3dParams { layers: 4, .. })));
        let StitchParams::Layered3d(p) = serde_json::from_value(serde_json::json!({ "type": "layered3d", "width": 8.0 })).unwrap() else { panic!() };
        assert_eq!((p.layers, p.shrink_per_layer, p.underlay_zigzag_spacing, p.satin.width), (2, 0.6, 3.0, 8.0), "defaults, the satin's own fields flat");
        assert!(p.base_thread.is_none() && !serde_json::to_string(&p).unwrap().contains("baseThread"));
    }

    #[test]
    fn j8_inner_layers_in_the_base_thread_metallic_only_on_top() {
        // NOVAstitch j.8: a layered 3D in metallic thread, inner layers in the polyester the operator chose
        let p = Layered3dParams { base_thread: Some("poly".into()), ..column(8.0, 3) };
        let d = doc(vec![obj("l", "metal", vec![line(pt(0.0, 0.0), pt(30.0, 0.0))], StitchParams::Layered3d(p))], &["poly", "metal"]);
        let plan = Engine::new().plan(&d);
        let ids: Vec<&str> = plan.threads.iter().map(|t| t.id.as_str()).collect();
        assert_eq!(ids, ["poly", "metal"], "the polyester first, the metallic after");
        let cc: Vec<usize> = plan.stitches.iter().enumerate().filter(|(_, s)| s.is(flags::COLOR_CHANGE)).map(|(i, _)| i).collect();
        assert_eq!(cc.len(), 1, "one colour change, before the final layer");
        let needle = |s: &&crate::plan::Stitch| s.flags & flags::COMMANDS == 0 && s.flags & flags::TIE == 0;
        // the final layer's edges (4 mm out) only after it, the inner layers (narrower) only before
        assert!(plan.stitches[..cc[0]].iter().filter(needle).all(|s| s.y.abs() < 4.0 - 0.1), "nothing of the final layer in polyester");
        assert!(plan.stitches[cc[0]..].iter().filter(needle).all(|s| s.y.abs() > 4.0 - 0.1 || s.flags & flags::JUMP != 0), "only the final layer in metallic");
        assert!(plan.stitches[cc[0]..].iter().filter(needle).count() > 50);
        // no base thread: one thread, no colour change
        let d = doc(vec![obj("l", "metal", vec![line(pt(0.0, 0.0), pt(30.0, 0.0))], StitchParams::Layered3d(column(8.0, 3)))], &["poly", "metal"]);
        let plan = Engine::new().plan(&d);
        assert_eq!(plan.threads.len(), 1);
        assert!(!plan.stitches.iter().any(|s| s.is(flags::COLOR_CHANGE)));
    }

    #[test]
    fn layered3d_in_info_cover_and_svg() {
        // the contract's exception of 24/11: info names it, it covers its column,
        // SVG draws it as its column with the final layer and names its type
        let st = |s: StitchParams| obj("l", "t", vec![line(pt(0.0, 0.0), pt(30.0, 0.0))], s);
        let l = StitchParams::Layered3d(column(8.0, 2));
        let s = StitchParams::Satin(column(8.0, 2).satin);
        let d = doc(vec![st(l.clone())], &["t"]);
        assert_eq!(crate::info::element_info(&d, &mut Engine::new(), &[]).objects[0].kind, "layered3d");
        let (cl, cs) = (crate::region::object_cover(&st(l)), crate::region::object_cover(&st(s.clone())));
        assert!(!cl.is_empty() && crate::region::covers_bounds(&cl) == crate::region::covers_bounds(&cs), "covers its column");
        let strip = |svg: String| svg.lines().map(|l| l.split(" filum:params=").next().unwrap().replace(" inkstitch:nova_stitch_type=\"layered3d\"", "")).collect::<Vec<_>>().join("\n");
        let (sl, ss) = (crate::svg::export_svg(&d), crate::svg::export_svg(&doc(vec![st(s)], &["t"])));
        assert!(sl.contains("inkstitch:nova_stitch_type=\"layered3d\""), "the type, named");
        assert_eq!(strip(sl), strip(ss), "otherwise its satin");
    }
}
