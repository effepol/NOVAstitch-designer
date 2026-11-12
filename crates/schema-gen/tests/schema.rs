//! The generated part of the public schema: up to date with the Rust types,
//! the fill parameters checked by hand, and the feature kept out of every
//! normal build (contract test a.17).

use std::path::PathBuf;
use std::process::Command;

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

#[test]
fn the_committed_schema_is_up_to_date() {
    let committed = std::fs::read_to_string(root().join(nova_schema_gen::CORE_PATH)).expect("schema/filum-core.schema.json is committed");
    assert!(
        committed == nova_schema_gen::core_schema_text(),
        "schema/filum-core.schema.json is not what the Rust types give: run `cargo run -p nova-schema-gen` and commit it"
    );
}

/// FillParams is read with `remote = "Self"` (older documents' `clockwise`):
/// its schema is checked by hand against what serde really writes and reads.
#[test]
fn fill_params_by_hand() {
    let schema = nova_schema_gen::core_schema();
    let fill = &schema["$defs"]["FillParams"];
    let props = fill["properties"].as_object().expect("FillParams has properties");
    // every key serde writes for the defaults is described
    let written = serde_json::to_value(filum_core::FillParams::default()).unwrap();
    for key in written.as_object().unwrap().keys() {
        assert!(props.contains_key(key), "FillParams writes `{key}` but the schema does not describe it");
    }
    // every described key is one serde reads (a document with it alone reads back with it)
    for key in props.keys() {
        let mut v = written.clone();
        if v.get(key).is_none() {
            continue; // optional, skipped when empty
        }
        v.as_object_mut().unwrap().retain(|k, _| k == key);
        let back: filum_core::FillParams = serde_json::from_value(v).unwrap_or_else(|e| panic!("FillParams with only `{key}`: {e}"));
        let back = serde_json::to_value(back).unwrap();
        assert_eq!(back.get(key), written.get(key), "`{key}` is read back as written");
    }
    // nothing is required: every field has a default (serde `default` on the struct)
    assert!(fill.get("required").is_none(), "FillParams requires nothing: {:?}", fill.get("required"));
    // contourClockwise is the name written today; the old `clockwise` is read flipped and stays allowed
    assert_eq!(props["contourClockwise"]["type"], "boolean");
    assert!(!props.contains_key("clockwise"));
    assert_ne!(fill.get("additionalProperties"), Some(&serde_json::Value::Bool(false)), "old keys (clockwise) stay allowed");
    let old: filum_core::FillParams = serde_json::from_value(serde_json::json!({ "clockwise": true })).unwrap();
    assert!(!old.clockwise, "an old `clockwise: true` reads as counter-clockwise");
    // the fill is the "fill" variant of StitchParams, tagged by `type`
    let variants = schema["$defs"]["StitchParams"]["oneOf"].as_array().expect("StitchParams is oneOf");
    let tags: Vec<&str> = variants.iter().filter_map(|v| v["properties"]["type"]["const"].as_str()).collect();
    assert_eq!(tags, ["none", "running", "satin", "fill", "applique", "manual"]);
}

/// a.17: without the feature, crates/core builds as before: no normal build
/// turns the `schema` feature on, so schemars (and its derives) stay out of
/// the engine, the command line and the WebAssembly engine.
#[test]
fn a17_the_schema_feature_stays_out_of_normal_builds() {
    let cargo = std::env::var("CARGO").unwrap_or_else(|_| "cargo".into());
    // the features of filum-core in a build: lines `filum-core feature "…"`
    let core_features = |args: &[&str]| {
        let out = Command::new(&cargo)
            .current_dir(root())
            .args(["tree", "-e", "features", "-i", "filum-core", "--prefix", "none"])
            .args(args)
            .output()
            .unwrap();
        assert!(out.status.success(), "cargo tree {args:?}: {}", String::from_utf8_lossy(&out.stderr));
        String::from_utf8_lossy(&out.stdout).lines().filter(|l| l.starts_with("filum-core feature")).map(String::from).collect::<Vec<_>>()
    };
    for pkg in ["filum-core", "filum-cli", "filum-wasm"] {
        let f = core_features(&["-p", pkg]);
        assert!(f.iter().any(|l| l.contains("\"default\"")), "{pkg} builds filum-core: {f:?}");
        assert!(!f.iter().any(|l| l.contains("\"schema\"")), "a.17 {pkg} builds filum-core without the schema feature: {f:?}");
    }
    // filum-core's own normal dependencies: no schemars
    let out = Command::new(&cargo).current_dir(root()).args(["tree", "-p", "filum-core", "-e", "normal", "--prefix", "none"]).output().unwrap();
    assert!(!String::from_utf8_lossy(&out.stdout).contains("schemars"), "a.17 schemars is not a dependency of filum-core without the feature");
    // the generator turns it on: the checks above can fail
    assert!(core_features(&["-p", "nova-schema-gen"]).iter().any(|l| l.contains("\"schema\"")));
}
