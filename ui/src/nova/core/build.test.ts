// The provisional build (module 0, request of 24/11): a GitHub workflow
// started by hand (.github/workflows/build.yml) that makes Tauri's installers
// for Windows (.msi and .exe), macOS (.dmg) and Linux (.AppImage and .deb) and
// attaches them to a release marked pre-release. No code signing for now.

import { check, done } from "./testkit";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const file = path.join(root, ".github/workflows/build.yml");
check(existsSync(file), "the workflow is there (.github/workflows/build.yml)");
const wf = existsSync(file) ? readFileSync(file, "utf8") : "";
const lock = readFileSync(path.join(root, "Cargo.lock"), "utf8");

const on = wf.slice(wf.indexOf("\non:"), wf.indexOf("\n", wf.indexOf("\non:") + 5) + 200);
check(/\non:\s*\n\s*workflow_dispatch:/.test(wf) && !/\n\s*(push|pull_request|schedule|release):/.test(on), "started by hand only (workflow_dispatch)");
// macOS is left out until 1.0 (Architect, 25/11): its lines stay in the file, commented, with how to turn them back on
const active = wf.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
check(/windows-latest/.test(active) && /ubuntu-22\.04/.test(active) && !/macos-latest/.test(active), "two runners for now: Windows and Linux (no macOS)");
check(/#\s*- os: macos-latest/.test(wf) && /#\s+rust-targets: aarch64-apple-darwin,x86_64-apple-darwin/.test(wf) && /#\s+args: --target universal-apple-darwin --bundles dmg/.test(wf), "macOS's lines are in the file, commented out");
check(/macOS.*1\.0/.test(wf) && /remove the leading «# »|togli il «# »|uncomment/i.test(wf), "the file says how to turn macOS back on (at 1.0)");
check(/--bundles msi,nsis/.test(wf), "Windows: .msi and .exe (NSIS)");
check(/--bundles dmg/.test(wf) && /universal-apple-darwin/.test(wf), "(macOS, when it is back: .dmg, one for Apple silicon and Intel)");
check(/--bundles deb,appimage/.test(wf), "Linux: .deb and .AppImage");
check(/tauri-apps\/tauri-action@v0/.test(wf) && /prerelease:\s*true/.test(wf) && /releaseDraft:\s*false/.test(wf), "the installers go to a release marked pre-release (published, not a draft)");
check(/contents:\s*write/.test(wf), "the workflow may create the release");
check(!/APPLE_CERTIFICATE|APPLE_SIGNING|TAURI_SIGNING_PRIVATE_KEY|WINDOWS_CERTIFICATE|certificateThumbprint/.test(wf), "no code signing");
const crate = lock.match(/name = "wasm-bindgen"\nversion = "([^"]+)"/)?.[1];
check(wf.includes(`wasm-bindgen-cli@${crate}`), `the engine's wasm-bindgen-cli matches Cargo.lock (${crate})`);
check(wf.indexOf("npm run wasm") > 0 && wf.indexOf("npm run wasm") < wf.indexOf("tauri-apps/tauri-action"), "the engine is built to WebAssembly before the app");
check(/libwebkit2gtk-4\.1-dev/.test(wf), "Linux: the system libraries Tauri needs");

done("build provvisoria");
