// Module l: threads[].nova.kind in the public schema (contract, section 2):
// "standard" | "metallic", absent = standard; anything else is refused.

import { check, done } from "../core/testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";

const schemaDir = path.resolve(process.cwd(), "..", "schema");
const json = (f: string) => JSON.parse(readFileSync(path.join(schemaDir, f), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
for (const f of ["double", "float"]) ajv.addFormat(f, { type: "number", validate: (n: number) => Number.isFinite(n) });
for (const f of ["uint", "uint8", "uint16", "uint32", "uint64", "int32", "int64", "int"]) ajv.addFormat(f, { type: "number", validate: (n: number) => Number.isInteger(n) });
ajv.addSchema(json("filum-core.schema.json"));
const validate = ajv.compile(json("nsd.schema.json"));

const base = JSON.parse(readFileSync(path.join(schemaDir, "examples", "Stemma.filum"), "utf8"));
const withKind = (kind: unknown) => ({ ...base, nova: { schemaVersion: 1 }, threads: base.threads.map((t: object, i: number) => (i === 0 ? { ...t, nova: { kind } } : t)) });

check(base.threads.length > 0 && !!validate({ ...base, nova: { schemaVersion: 1 } }), "un filo senza nova.kind: valido (standard)");
check(!!validate(withKind("metallic")) && !!validate(withKind("standard")), "nova.kind = metallic / standard: valido");
check(!validate(withKind("wool")) && !validate(withKind(1)), "un tipo sconosciuto è rifiutato (la lana arriverà con una versione nuova dello schema)");

done("module l schema");
