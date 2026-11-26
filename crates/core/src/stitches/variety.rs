//! NOVAstitch (module n): stitch varieties of the tatami rows and of the
//! split satin stitches.
//!
//! A variety replaces Filum's even stitch with a sequence of lengths (e.g.
//! 4–2–4–2 mm) and its regular stagger with a sequence of shifts from row to
//! row (e.g. 0, ⅓, ⅔ of the sequence); or with random lengths and shifts
//! inside a range, repeatable with the object's seed. Which wins, for lengths
//! and shifts each: the random range, then the sequence, then Filum's value.
//! Fields absent: no variety, Filum's own code sews (the same stitches as
//! before).
//!
//! Declared from `fill.rs` (`#[path]`), so `stitches/mod.rs` is not touched.

use crate::prng::Stream;

/// Shortest length a variety sews (mm): smaller values are raised to it.
const MIN_LEN: f64 = 0.1;
/// More needle points than this on one line: something is wrong, stop there.
const MAX_POINTS: usize = 100_000;

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum Lengths {
    /// Filum's even stitch.
    Fixed(f64),
    /// Used in turn.
    Pattern(Vec<f64>),
    /// Random between the two (mm).
    Range(f64, f64),
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum Shifts {
    /// Filum's stagger: row `k` starts `(k / n) mod 1` of a period on.
    Stagger(u32),
    /// Row `k` starts `pattern[k mod len]` of a period on.
    Pattern(Vec<f64>),
    /// Random share of a period between the two.
    Range(f64, f64),
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Variety {
    pub lengths: Lengths,
    pub shifts: Shifts,
    pub seed: u32,
}

/// A sequence of lengths: positive finite values, at least [`MIN_LEN`].
fn lengths_of(v: &[f64]) -> Option<Vec<f64>> {
    let v: Vec<f64> = v.iter().filter(|x| x.is_finite() && **x > 0.0).map(|x| x.max(MIN_LEN)).collect();
    (!v.is_empty()).then_some(v)
}

/// A sequence of shifts: finite values.
fn shifts_of(v: &[f64]) -> Option<Vec<f64>> {
    let v: Vec<f64> = v.iter().copied().filter(|x| x.is_finite()).collect();
    (!v.is_empty()).then_some(v)
}

/// A range in order, both ends finite and not below `min`.
fn range_of(r: Option<[f64; 2]>, min: f64) -> Option<(f64, f64)> {
    let [a, b] = r?;
    if !a.is_finite() || !b.is_finite() {
        return None;
    }
    let (a, b) = (a.min(b).max(min), a.max(b).max(min));
    Some((a, b))
}

impl Variety {
    /// The variety of an object's fields, or `None` when it has none (Filum's
    /// stitches). `base_len` and `staggers` are Filum's values, used for what
    /// the variety leaves out.
    pub fn new(length_pattern: &[f64], offset_pattern: &[f64], length_range: Option<[f64; 2]>, offset_range: Option<[f64; 2]>, base_len: f64, staggers: u32, seed: u32) -> Option<Variety> {
        let lengths = match (range_of(length_range, MIN_LEN), lengths_of(length_pattern)) {
            (Some((a, b)), _) => Some(Lengths::Range(a, b)),
            (None, Some(p)) => Some(Lengths::Pattern(p)),
            _ => None,
        };
        let shifts = match (range_of(offset_range, f64::NEG_INFINITY), shifts_of(offset_pattern)) {
            (Some((a, b)), _) => Some(Shifts::Range(a, b)),
            (None, Some(p)) => Some(Shifts::Pattern(p)),
            _ => None,
        };
        if lengths.is_none() && shifts.is_none() {
            return None;
        }
        let base = if base_len.is_finite() && base_len > 0.0 { base_len.max(MIN_LEN) } else { 3.0 };
        Some(Variety { lengths: lengths.unwrap_or(Lengths::Fixed(base)), shifts: shifts.unwrap_or(Shifts::Stagger(staggers.max(1))), seed })
    }

    /// The length the shifts are a share of (mm): the whole sequence, the
    /// middle of the range, or the even stitch.
    pub fn period(&self) -> f64 {
        match &self.lengths {
            Lengths::Fixed(l) => *l,
            Lengths::Pattern(p) => p.iter().sum(),
            Lengths::Range(a, b) => (a + b) / 2.0,
        }
    }

    /// The longest stitch the variety makes (mm): satin stitches up to this stay whole.
    pub fn longest(&self) -> f64 {
        match &self.lengths {
            Lengths::Fixed(l) => *l,
            Lengths::Pattern(p) => p.iter().copied().fold(0.0, f64::max),
            Lengths::Range(_, b) => *b,
        }
    }

    /// Row (or satin stitch) `row`'s shift, as a share of the period.
    fn shift(&self, row: i64) -> f64 {
        match &self.shifts {
            Shifts::Stagger(n) => (row as f64 / *n as f64).rem_euclid(1.0),
            Shifts::Pattern(p) => p[row.rem_euclid(p.len() as i64) as usize],
            Shifts::Range(a, b) => a + (b - a) * crate::prng::uniform(self.seed, 0x7A71_E7A0, row as u64),
        }
    }

    /// Needle points of line `row` between `x0` and `x1` (positions along the
    /// line, ascending), leaving out those within `gap` of either end. The
    /// points lie on a grid that is the same for every line with the same
    /// shift, so the pattern lines up across a fill however its rows are cut.
    pub fn points(&self, row: i64, x0: f64, x1: f64, gap: f64) -> Vec<f64> {
        let mut out = Vec::new();
        if !(x1 > x0) || !x0.is_finite() || !x1.is_finite() {
            return out;
        }
        let period = self.period();
        let shift = self.shift(row) * period;
        let k0 = ((x0 - shift) / period).floor();
        let mut x = shift + k0 * period;
        let (lo, hi) = (x0 + gap, x1 - gap);
        let keep = |x: f64, out: &mut Vec<f64>| {
            if x > lo && x < hi {
                out.push(x);
            }
        };
        match &self.lengths {
            Lengths::Fixed(_) | Lengths::Pattern(_) => {
                let steps: Vec<f64> = match &self.lengths {
                    Lengths::Fixed(l) => vec![*l],
                    Lengths::Pattern(p) => p.clone(),
                    Lengths::Range(..) => unreachable!(),
                };
                let mut i = 0usize;
                while x < hi && out.len() < MAX_POINTS {
                    keep(x, &mut out);
                    x += steps[i % steps.len()];
                    i += 1;
                }
            }
            Lengths::Range(a, b) => {
                // a random walk from the grid point before the line: the same
                // row and grid point always give the same lengths
                let stream = (row as u64).wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ (k0 as i64 as u64).wrapping_mul(0xC2B2_AE3D_27D4_EB4F) ^ 0x7A71_E7A1;
                let mut rng = Stream::new(self.seed, stream);
                while x < hi && out.len() < MAX_POINTS {
                    keep(x, &mut out);
                    x += a + (b - a) * rng.next();
                }
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gaps(v: &[f64]) -> Vec<f64> {
        v.windows(2).map(|w| w[1] - w[0]).collect()
    }

    #[test]
    fn nothing_set_is_no_variety() {
        assert_eq!(Variety::new(&[], &[], None, None, 3.0, 4, 1), None);
        // values that cannot be sewn count as absent
        assert_eq!(Variety::new(&[0.0, -1.0, f64::NAN], &[f64::INFINITY], Some([f64::NAN, 2.0]), None, 3.0, 4, 1), None);
    }

    #[test]
    fn a_pattern_alternates_and_repeats_on_a_grid() {
        let v = Variety::new(&[4.0, 2.0], &[], None, None, 3.0, 1, 1).unwrap();
        let p = v.points(0, 0.5, 30.0, 0.25);
        let g = gaps(&p);
        for w in g.windows(2) {
            assert!((w[0] + w[1] - 6.0).abs() < 1e-9 && (w[0] - 4.0).abs().min((w[0] - 2.0).abs()) < 1e-9, "{g:?}");
        }
        // the same points from another start: the grid does not move
        let q = v.points(0, 3.0, 30.0, 0.25);
        assert!(q.iter().all(|x| p.iter().any(|y| (x - y).abs() < 1e-9)));
    }

    #[test]
    fn shifts_are_a_share_of_the_period() {
        let v = Variety::new(&[4.0, 2.0], &[0.0, 1.0 / 3.0, 2.0 / 3.0], None, None, 3.0, 1, 1).unwrap();
        for row in 0..6 {
            let p = v.points(row, 0.0, 40.0, 0.25);
            let s = (row % 3) as f64 * 2.0;
            assert!(p.iter().all(|x| ((x - s).rem_euclid(6.0) - 0.0).abs() < 1e-6 || ((x - s).rem_euclid(6.0) - 4.0).abs() < 1e-6), "row {row}: {p:?}");
        }
    }

    #[test]
    fn a_range_is_random_inside_and_repeatable() {
        let v = Variety::new(&[], &[], Some([4.5, 2.5]), Some([0.0, 1.0]), 3.0, 4, 7).unwrap();
        let p = v.points(3, 0.0, 50.0, 0.25);
        assert!(gaps(&p).iter().all(|g| (2.5 - 1e-9..=4.5 + 1e-9).contains(g)));
        assert_eq!(p, v.points(3, 0.0, 50.0, 0.25));
        let w = Variety { seed: 8, ..v.clone() };
        assert_ne!(p, w.points(3, 0.0, 50.0, 0.25));
    }

    #[test]
    fn the_range_wins_over_the_pattern() {
        let v = Variety::new(&[4.0, 2.0], &[0.0, 0.5], Some([2.5, 4.5]), Some([0.0, 1.0]), 3.0, 4, 1).unwrap();
        assert_eq!(v.lengths, Lengths::Range(2.5, 4.5));
        assert_eq!(v.shifts, Shifts::Range(0.0, 1.0));
    }

    /// n.1: the plan of a test file, as a fingerprint (FNV-1a of every
    /// stitch, coordinates to 1e-6 mm).
    fn fingerprint(file: &str) -> (usize, u64) {
        let text = std::fs::read_to_string(format!("{}/../../schema/examples/{file}", env!("CARGO_MANIFEST_DIR"))).unwrap();
        let doc: crate::model::Document = serde_json::from_str(&text).unwrap();
        let plan = crate::assemble::Engine::new().plan(&doc);
        let mut h: u64 = 0xcbf2_9ce4_8422_2325;
        for s in &plan.stitches {
            for v in [(s.x * 1e6).round() as i64 as u64, (s.y * 1e6).round() as i64 as u64, s.flags as u64, s.object as u64] {
                for b in v.to_le_bytes() {
                    h = (h ^ b as u64).wrapping_mul(0x100_0000_01b3);
                }
            }
        }
        (plan.stitches.len(), h)
    }

    #[test]
    fn n1_old_files_sew_as_before() {
        // taken on main before module n (26/11): tatami and satin of the test files
        let text = std::fs::read_to_string(format!("{}/../../schema/examples/completo.nsd", env!("CARGO_MANIFEST_DIR"))).unwrap();
        assert!(text.contains("\"tatami\"") && text.contains("\"satin\""));
        assert_eq!(fingerprint("Stemma.filum"), (12550, 17125093263148416306));
        assert_eq!(fingerprint("Stemma.nsd"), (12550, 10481459970429607690));
        assert_eq!(fingerprint("completo.nsd"), (12550, 10481459970429607690));
    }

    // ---- tatami (n.2–n.6) ----

    use crate::model::{FillParams, SubPath};
    use crate::plan::flags;

    fn square(s: f64) -> Vec<SubPath> {
        vec![SubPath::polyline(&[crate::geom::pt(0.0, 0.0), crate::geom::pt(s, 0.0), crate::geom::pt(s, s), crate::geom::pt(0.0, s)], true)]
    }

    fn tatami(p: &FillParams) -> Vec<Vec<f64>> {
        tatami_on(&square(12.0), p)
    }

    /// The top rows of a tatami at angle 0: the x of every needle point, row by row (ascending y).
    fn tatami_on(paths: &[SubPath], p: &FillParams) -> Vec<Vec<f64>> {
        let p = FillParams { underlay: false, angle: 0.0, ..p.clone() };
        let runs = super::super::fill_on(paths, &p, &crate::model::Fabric::Cotton.profile(), None, None);
        let mut rows: Vec<(f64, Vec<f64>)> = Vec::new();
        for r in &runs {
            for &(q, f) in r {
                if f & (flags::UNDERLAY | flags::TRAVEL) != 0 {
                    continue;
                }
                match rows.iter_mut().find(|(y, _)| (y - q.y).abs() < 1e-6) {
                    Some((_, xs)) => xs.push(q.x),
                    None => rows.push((q.y, vec![q.x])),
                }
            }
        }
        rows.sort_by(|a, b| a.0.total_cmp(&b.0));
        rows.into_iter()
            .map(|(_, mut xs)| {
                xs.sort_by(f64::total_cmp);
                xs.dedup_by(|a, b| (*a - *b).abs() < 1e-9);
                xs
            })
            .filter(|xs| xs.len() > 3)
            .collect()
    }

    /// The stitches inside a row: all but the first and the last.
    fn inner(xs: &[f64]) -> Vec<f64> {
        let g = gaps(xs);
        g[1..g.len() - 1].to_vec()
    }

    fn lungo_corto() -> FillParams {
        FillParams { length_pattern: vec![4.0, 2.0], ..Default::default() }
    }

    #[test]
    fn n2_tatami_length_pattern_alternates() {
        let rows = tatami(&lungo_corto());
        assert!(rows.len() > 20);
        for xs in &rows {
            let g = inner(xs);
            for (i, w) in g.windows(2).enumerate() {
                let ok = ((w[0] - 4.0).abs() < 0.05 && (w[1] - 2.0).abs() < 0.05) || ((w[0] - 2.0).abs() < 0.05 && (w[1] - 4.0).abs() < 0.05);
                assert!(ok, "stitch {i} of {g:?}");
            }
        }
    }

    /// The row's shift on a 4–2 grid (0, 2 or 4 mm), if every inner point is on it.
    fn shift_of(xs: &[f64]) -> Option<f64> {
        [0.0, 2.0, 4.0].into_iter().find(|s| {
            xs[1..xs.len() - 1].iter().all(|x| {
                let m = (x - s).rem_euclid(6.0);
                m.min(6.0 - m) < 0.05 || (m - 4.0).abs() < 0.05
            })
        })
    }

    #[test]
    fn n3_tatami_offset_pattern_shifts_each_row() {
        let rows = tatami(&FillParams { offset_pattern: vec![0.0, 0.333333, 0.666667], ..lungo_corto() });
        let shifts: Vec<f64> = rows.iter().map(|xs| shift_of(xs).unwrap_or_else(|| panic!("{xs:?}"))).collect();
        // row k is (k mod 3) × 2 mm on: from row to row 2 mm more
        for w in shifts.windows(2) {
            assert!(((w[1] - w[0]).rem_euclid(6.0) - 2.0).abs() < 1e-6, "{shifts:?}");
        }
    }

    fn all_inner(rows: &[Vec<f64>]) -> Vec<f64> {
        rows.iter().flat_map(|xs| inner(xs)).collect()
    }

    #[test]
    fn n4_tatami_length_range_is_random_and_repeatable() {
        let p = FillParams { length_range: Some([2.5, 4.5]), seed: 3, ..Default::default() };
        let a = tatami(&p);
        let g = all_inner(&a);
        assert!(g.len() > 50 && g.iter().all(|l| (2.5 - 1e-6..=4.5 + 1e-6).contains(l)), "{g:?}");
        // not even: several lengths
        assert!(g.iter().any(|l| (l - g[0]).abs() > 0.2));
        assert_eq!(a, tatami(&p), "same seed, same stitches");
        assert_ne!(a, tatami(&FillParams { seed: 4, ..p }), "another seed, other stitches");
    }

    #[test]
    fn n5_tatami_offset_range_is_inside_and_repeatable() {
        // even 3 mm stitches: a row's shift is its first inner point modulo 3
        let p = FillParams { max_stitch_length: 3.0, offset_range: Some([0.2, 0.5]), seed: 5, ..Default::default() };
        let a = tatami(&p);
        for xs in &a {
            let s = xs[1].rem_euclid(3.0) / 3.0;
            assert!((0.2 - 1e-6..=0.5 + 1e-6).contains(&s), "{s} {xs:?}");
        }
        let firsts: Vec<f64> = a.iter().map(|xs| xs[1]).collect();
        assert!(firsts.iter().any(|x| (x - firsts[0]).abs() > 0.05), "the shifts vary");
        assert_eq!(a, tatami(&p));
        assert_ne!(a, tatami(&FillParams { seed: 6, ..p }));
    }

    #[test]
    fn n6_the_range_wins_over_the_sequence() {
        let both = FillParams { length_range: Some([2.5, 4.5]), offset_range: Some([0.0, 1.0]), offset_pattern: vec![0.0, 0.5], seed: 2, ..lungo_corto() };
        let only = FillParams { length_pattern: vec![], offset_pattern: vec![], ..both.clone() };
        assert_eq!(tatami(&both), tatami(&only));
    }

    #[test]
    fn the_underlay_keeps_filum_s_stitches() {
        let under = |p: &FillParams| -> Vec<crate::geom::Point> {
            let p = FillParams { underlay: true, ..p.clone() };
            super::super::fill_on(&square(12.0), &p, &crate::model::Fabric::Cotton.profile(), None, None).iter().flatten().filter(|x| x.1 & flags::UNDERLAY != 0).map(|x| x.0).collect()
        };
        assert_eq!(under(&lungo_corto()), under(&FillParams::default()));
    }

    #[test]
    fn n12_tatami_fields_round_trip_and_stay_out_when_absent() {
        let json = r#"{"lengthPattern":[4.0,2.0],"offsetPattern":[0.0,0.333333,0.666667],"lengthRange":[2.5,4.5],"offsetRange":[0.0,1.0]}"#;
        let p: FillParams = serde_json::from_str(json).unwrap();
        assert_eq!(p.offset_pattern, vec![0.0, 0.333333, 0.666667]);
        let back = serde_json::to_value(&p).unwrap();
        for k in ["lengthPattern", "offsetPattern", "lengthRange", "offsetRange"] {
            assert_eq!(back[k], serde_json::from_str::<serde_json::Value>(json).unwrap()[k], "{k}");
        }
        let plain = serde_json::to_value(FillParams::default()).unwrap();
        for k in ["lengthPattern", "offsetPattern", "lengthRange", "offsetRange"] {
            assert!(plain.get(k).is_none(), "{k} written when absent");
        }
    }
}
