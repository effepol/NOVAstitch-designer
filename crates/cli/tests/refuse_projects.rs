//! Contract test a.12 (module a): the command line never writes a project.
//! A .filum or .nsd written by the Rust engine would lose every field the
//! engine does not know (nova, groups, letterings, reference pictures), so
//! `convert`, `optimize` and `digitize` refuse such an output with a message,
//! before reading anything, and no file is written.

use std::path::{Path, PathBuf};
use std::process::Command;

fn folder(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("nova-a12-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

const SVG: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="16" fill="#336699"/></svg>"##;
const NSD: &str = "{\n  \"version\": 1,\n  \"name\": \"Stemma\",\n  \"objects\": [],\n  \"nova\": { \"schemaVersion\": 1 }\n}\n";

fn listing(dir: &Path) -> Vec<String> {
    let mut v: Vec<String> = std::fs::read_dir(dir).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect();
    v.sort();
    v
}

fn run(dir: &Path, args: &[&str]) -> std::process::Output {
    Command::new(env!("CARGO_BIN_EXE_filum")).current_dir(dir).args(args).output().unwrap()
}

#[test]
fn a12_convert_nsd_to_nsd_is_refused_and_writes_nothing() {
    let dir = folder("convert");
    std::fs::write(dir.join("disegno.nsd"), NSD).unwrap();
    let out = run(&dir, &["convert", "disegno.nsd", "copia.nsd"]);
    let err = String::from_utf8_lossy(&out.stderr);
    assert!(!out.status.success(), "a.12 the command fails");
    assert!(err.contains("copia.nsd") && err.contains("NOVAstitch Designer"), "a.12 with a message naming the file: {err}");
    assert_eq!(listing(&dir), vec!["disegno.nsd"], "a.12 no file written");
    assert_eq!(std::fs::read_to_string(dir.join("disegno.nsd")).unwrap(), NSD, "the input is untouched");
}

#[test]
fn every_writing_command_refuses_a_project_output() {
    let dir = folder("all");
    std::fs::write(dir.join("in.svg"), SVG).unwrap();
    std::fs::write(dir.join("disegno.filum"), NSD).unwrap();
    for args in [
        &["convert", "in.svg", "out.filum"][..],
        &["convert", "in.svg", "out.NSD"],
        &["convert", "in.svg", "out.Filum"],
        &["convert", "disegno.filum", "disegno.filum"],
        &["optimize", "in.svg", "out.nsd"],
        &["optimize", "in.svg", "out.filum"],
        &["digitize", "in.svg", "out.nsd"],
        &["digitize", "in.svg", "out.filum", "--colors", "2"],
    ] {
        let out = run(&dir, args);
        assert!(!out.status.success(), "{args:?} is refused");
        assert!(String::from_utf8_lossy(&out.stderr).contains("NOVAstitch Designer"), "{args:?} says why");
        assert_eq!(listing(&dir), vec!["disegno.filum", "in.svg"], "{args:?} writes no file");
        assert_eq!(std::fs::read_to_string(dir.join("disegno.filum")).unwrap(), NSD, "{args:?} leaves the .filum as it was");
    }
}

#[test]
fn machine_files_are_still_written() {
    let dir = folder("dst");
    std::fs::write(dir.join("in.svg"), SVG).unwrap();
    let out = run(&dir, &["convert", "in.svg", "out.dst"]);
    assert!(out.status.success(), "convert to DST still works: {}", String::from_utf8_lossy(&out.stderr));
    assert!(dir.join("out.dst").is_file());
}
