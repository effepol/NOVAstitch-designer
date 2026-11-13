# NOVAstitch Designer project schema (.nsd)

Public JSON Schema (2020-12) of the `.nsd` project file: the JSON of a Filum
design (`version` 1) plus the `nova` block. Licence: **CC0 1.0**
(<https://creativecommons.org/publicdomain/zero/1.0/>); the program is GPL-3.0-or-later.

| File | What | How it is made |
|---|---|---|
| `nsd.schema.json` | The entry point (`$id` `urn:novastitch:schema:nsd`): `nova`, and the fields only the interface knows (`references`, `groupNames`, `groupParents`, an object's `group`, `text`, `routed`, `nova`) | Written by hand |
| `filum-core.schema.json` | The Filum part (`$id` `urn:novastitch:schema:filum-core`) | Generated from `crates/core/src/model.rs`: `cargo run -p nova-schema-gen` |
| `examples/` | Test files: every one validates (test a.8) | `Stemma.filum` is Filum's sample saved by Filum 0.2.1; `Stemma.nsd` is the same written by NOVAstitch |

Rules (contract, section 2):

- `nova.schemaVersion` goes up by 1 only for an incompatible change; a new optional field with a default leaves it as it is.
- Unknown fields are allowed everywhere, and readers keep them, untouched.
- A file with a `nova.schemaVersion` newer than the reader's opens read-only.
- Readable, indented JSON; no compression, no encoding.

Checks: `cargo test -p nova-schema-gen` (the generated file is up to date; the fill
parameters, read with `remote = "Self"`, checked by hand; test a.17) and
`ui/src/nova/format/schema.test.ts` (test a.8).
