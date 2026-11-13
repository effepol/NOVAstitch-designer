// The migrations (contract, section 2): a chain v0 → v1 → …, each one a pure
// function with its own test. Unknown fields are kept at every step.

import { check, done } from "../core/testkit";
import { MIGRATIONS, migrate } from "./migrate";
import { NOVA_SCHEMA, novaDefaults } from "./nova";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

check(MIGRATIONS.length === NOVA_SCHEMA, `one migration for every step up to the current schema (${MIGRATIONS.length} for schema ${NOVA_SCHEMA})`);

// v0 → v1: a Filum design gets the nova block with its defaults; nothing else changes
{
  const obj = { id: "o1", thread: "t1", paths: [], stitch: { type: "fill", foo: 1 }, bar: 2 };
  const v0 = { version: 1, name: "Stemma", objects: [obj], foo: { deep: [1] } };
  const frozen = JSON.stringify(v0);
  const v1 = MIGRATIONS[0](v0);
  check(JSON.stringify(v0) === frozen, "v0→v1 is pure: its input is not changed");
  check(same(v1.nova, novaDefaults()) && (v1.nova as { schemaVersion: number }).schemaVersion === 1, "v0→v1 adds nova with the defaults, schemaVersion 1");
  check(same(v1.objects, v0.objects) && same(v1.foo, v0.foo) && v1.name === "Stemma" && v1.version === 1, "v0→v1 keeps every other field, unknown ones included");
  check(Object.keys(v1).join() === "version,name,objects,foo,nova", `v0→v1 keeps the order of the fields, nova last (${Object.keys(v1).join()})`);
  check(same(MIGRATIONS[0](v0), v1), "v0→v1 gives the same result every time");
}

// the chain: from 0 to the current version; already current: untouched
{
  const v0 = { version: 1, objects: [] };
  const r = migrate(v0, 0);
  check((r.nova as { schemaVersion: number }).schemaVersion === NOVA_SCHEMA, "migrate(v0) reaches the current version");
  const cur = { version: 1, objects: [], nova: novaDefaults() };
  check(migrate(cur, NOVA_SCHEMA) === cur, "migrate(current) returns the document itself");
  let threw = false;
  try {
    migrate(cur, NOVA_SCHEMA + 1);
  } catch {
    threw = true;
  }
  check(threw, "migrate refuses a version newer than the program's (that file is opened read-only, never migrated)");
}

done("module a, migrations");
