// The GitHub checks (.github/workflows/test.yml) run `npm test`, with the
// wasm-bindgen CLI of the same version as the crate in Cargo.lock.

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const workflow = readFileSync(path.join(root, ".github/workflows/test.yml"), "utf8");
const lock = readFileSync(path.join(root, "Cargo.lock"), "utf8");

const crate = lock.match(/name = "wasm-bindgen"\nversion = "([^"]+)"/)?.[1];
const cli = workflow.match(/wasm-bindgen-cli@([0-9.]+)/)?.[1];
check(!!crate && crate === cli, `the workflow's wasm-bindgen-cli matches Cargo.lock (cli ${cli}, crate ${crate})`);
check(/on:\s*\n\s*pull_request:/.test(workflow), "the checks run on every pull request");
check(/run: npm run wasm/.test(workflow) && /run: npm test/.test(workflow), "they build the engine to WebAssembly, then run npm test");

done("CI");
