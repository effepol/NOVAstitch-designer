//! Writes schema/filum-core.schema.json (run from the repository's root):
//!
//! ```text
//! cargo run -p nova-schema-gen
//! ```

fn main() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let path = root.join(nova_schema_gen::CORE_PATH);
    std::fs::write(&path, nova_schema_gen::core_schema_text()).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
    println!("wrote {}", nova_schema_gen::CORE_PATH);
}
