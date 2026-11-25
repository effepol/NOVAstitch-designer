//! NOVAstitch (module 0, request of 25/11): the command is `novastitch`, and
//! its help speaks of `novastitch`, not Filum's `filum`.

use std::process::Command;

#[test]
fn the_command_is_novastitch_and_its_help_says_so() {
    let out = Command::new(env!("CARGO_BIN_EXE_novastitch")).output().unwrap();
    let help = String::from_utf8_lossy(&out.stderr);
    assert!(!out.status.success(), "no command: the help, and a failure");
    assert!(help.starts_with("novastitch 0.1.1 (NOVAstitch Designer)"), "the help names the command and its version: {help}");
    for cmd in ["convert <in> <out>", "info <file>", "optimize <in> <out>", "digitize <image> <out>", "formats"] {
        assert!(help.contains(&format!("novastitch {cmd}")), "the help shows `novastitch {cmd}`: {help}");
    }
    assert!(!help.contains("filum "), "no `filum` command in the help: {help}");
}

#[test]
fn the_source_and_the_guide_name_no_filum_command() {
    let src = include_str!("../src/main.rs");
    assert!(!src.lines().filter(|l| l.starts_with("//! ")).any(|l| l.starts_with("//! filum ")), "the examples at the top use `novastitch`");
    let guide = include_str!("../../../docs/wiki/Command-Line.md");
    assert!(!guide.contains("filum convert") && !guide.contains("filum info") && !guide.contains("filum formats"), "the guide uses `novastitch`");
}
