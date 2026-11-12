// Test B (approved 12/11): no browser version — desktop only (Windows, macOS, Linux).

import { check, done } from "./testkit";
import { readFileSync } from "node:fs";
import path from "node:path";

const ui = process.cwd();
const root = path.resolve(ui, "..");
const read = (p: string) => readFileSync(p, "utf8");

const scripts = JSON.parse(read(path.join(root, "package.json"))).scripts as Record<string, string>;
check(!("build:web" in scripts), "B the package has no build:web");
check(!("dev" in scripts), "B the package has no browser-only start (npm run dev)");
// mobile goes with the browser (decision 2, 12/11)
for (const k of ["android:dev", "ios:dev"]) check(!(k in scripts), `B the package has no ${k}`);
const shellToml = read(path.join(root, "src-tauri/Cargo.toml"));
check(!/staticlib|cdylib/.test(shellToml) && !/iOS|Android/.test(shellToml), "B the Tauri shell builds no mobile library");
check(!read(path.join(root, "src-tauri/src/lib.rs")).includes("mobile_entry_point"), "B the Tauri shell has no mobile entry point");

const platform = read(path.join(ui, "src/lib/platform.ts"));
for (const s of ["showSaveFilePicker", 'createElement("input")', "URL.createObjectURL", "window.open("])
  check(!platform.includes(s), `B platform.ts has no browser branch (${s})`);

const readme = read(path.join(root, "README.md"));
check(!/runs in the browser|in your browser/i.test(readme), "B the README does not promise a browser version");

done("desktop only");
