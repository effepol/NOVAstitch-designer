// Red look and NS icon (contract, module 0, «Aspetto rosso e icona NS», Signor Poletti 18/11):
// tests r.1–r.6. The first swatch's label («Rosso NOVAstitch Designer») is module i's.

import { check, done } from "./testkit";
import { existsSync, readFileSync, readdirSync, statSync, type Buffer } from "node:fs";
import path from "node:path";
import { ACCENTS, APP_COLOR, DEFAULT_PREFS, accentTokens } from "../../lib/prefs";

const ui = process.cwd();
const root = path.resolve(ui, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");
const bytes = (p: string) => readFileSync(path.join(root, p)) as unknown as Buffer;

// ---- r.1 no Filum violet in the code (LICENSE, credits and module i's reference files excepted)
const VIOLETS = /#(7c3aed|8a4fef|6a32cc|b08cf6|a375f2)\b/i;
const SKIP_DIRS = new Set([".git", "node_modules", "target", "dist", "pkg", "wasm"]);
const EXEMPT = [/^LICENSE$/, /^NOTICE$/, /^ui\/src\/nova\/i18n\/filum\/(riferimento|origine)/, /^ui\/public\/licenses\//];
const TEXT = /\.(ts|tsx|mjs|js|css|html|json|svg|py|rs|md|toml)$/;
const walk = (dir: string): string[] =>
  readdirSync(path.join(root, dir)).flatMap((f) => {
    const rel = dir ? `${dir}/${f}` : f;
    if (SKIP_DIRS.has(f)) return [];
    return statSync(path.join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
const violet = walk("").filter((f) => TEXT.test(f) && !EXEMPT.some((r) => r.test(f)) && VIOLETS.test(readFileSync(path.join(root, f), "utf8")));
check(violet.length === 0, `r.1 no Filum violet in the code (found in: ${violet.join(", ") || "none"})`);

// ---- r.2 new preferences: accent #CC1219, first swatch the app red
check(APP_COLOR === "#CC1219" && DEFAULT_PREFS.accent === "#CC1219" && ACCENTS[0].color === APP_COLOR, "r.2 the default accent and the first swatch are #CC1219");
const css = read("ui/src/styles.css");
const block = (sel: RegExp) => css.slice(css.search(sel), css.indexOf("}", css.search(sel)));
const light = block(/\[data-theme="light"\]\s*\{/);
const dark = block(/\[data-theme="dark"\]\s*\{/);
const tok = (b: string, name: string) => b.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();
check(tok(light, "accent") === "#cc1219" && tok(light, "accent-text") === "#b30f16" && tok(dark, "accent-text") === "#ff7a7f", "r.2 styles.css: --accent #CC1219, --accent-text #B30F16 (light) and #FF7A7F (dark)");

// ---- r.3 contrast at least 4.5:1: white on the accent, --accent-text on the background, both themes
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
for (const theme of ["light", "dark"] as const) {
  const t = accentTokens(APP_COLOR, theme);
  const bg = tok(theme === "light" ? light : dark, "bg")!;
  const onAccent = contrast("#ffffff", t["--accent"]);
  const text = contrast(t["--accent-text"], bg);
  check(onAccent >= 4.5 && text >= 4.5, `r.3 ${theme}: white on the accent ${onAccent.toFixed(2)}:1, accent text on the background ${text.toFixed(2)}:1`);
  check(t["--accent-text"].toLowerCase() === tok(theme === "light" ? light : dark, "accent-text"), `r.3 ${theme}: applyAccent sets --accent-text as styles.css has it`);
}

// ---- r.4 every error or danger component has an icon and a text
const app = read("ui/src/App.tsx");
check(/t\.kind === "error"[^\n]*<[A-Z][A-Za-z]* size/.test(app), "r.4 an error toast shows an icon beside its text");
for (const sel of [".hint.warn", ".dz-hint.warn", ".badge.warn", ".font-meta.warn", ".tm-report.warn", ".mine-report.warn", ".dz-stats .warn", ".btn.danger"])
  check(new RegExp(`${sel.replace(/\./g, "\\.")}::before\\s*\\{[^}]*mask`).test(css) || new RegExp(`${sel.replace(/\./g, "\\.")}::before[^{]*\\{[^}]*mask`).test(css) || css.includes(`${sel}::before`), `r.4 ${sel} gets an icon before its text`);
const inlineDanger = walk("ui/src").filter((f) => /\.tsx$/.test(f) && /style=\{\{\s*color:\s*"var\(--danger/.test(readFileSync(path.join(root, f), "utf8")));
check(inlineDanger.length === 0, `r.4 no message is red by colour alone (inline --danger colours: ${inlineDanger.join(", ") || "none"})`);
check(/<SeverityIcon level=\{i\.level\} \/>/.test(read("ui/src/components/Dock.tsx")), "r.4 the issues list keeps its severity icons");

// ---- r.5 the selection outline is blue whatever the accent
for (const a of [APP_COLOR, "#1971c2", "#2b8a3e"]) check(!("--select" in accentTokens(a, "light")) && !("--select" in accentTokens(a, "dark")), `r.5 the accent ${a} does not change the selection colour`);
check(tok(light, "select") === "#1971c2" && tok(dark, "select") === "#4dabf7", "r.5 --select is blue: #1971C2 light, #4DABF7 dark");

// ---- r.6 every icon tauri.conf.json asks for exists; 16–32 px come from the simplified variant
const tauri = JSON.parse(read("src-tauri/tauri.conf.json"));
const icons: string[] = tauri.bundle.icon;
check(icons.every((i) => existsSync(path.join(root, "src-tauri", i))), `r.6 every icon in tauri.conf.json exists (${icons.join(", ")})`);
const small = (n: number) => bytes(`assets/icon/ns-small-${n}.png`);
check([16, 24, 32].every((n) => existsSync(path.join(root, `assets/icon/ns-small-${n}.png`))), "r.6 the simplified variant exists at 16, 24 and 32 px (assets/icon)");
check(bytes("src-tauri/icons/32x32.png").equals(small(32)), "r.6 icons/32x32.png is the simplified variant");
// .ico: the 16, 24 and 32 px entries are the simplified PNGs, byte for byte
const ico = bytes("src-tauri/icons/icon.ico");
const icoEntries = Array.from({ length: ico.readUInt16LE(4) }, (_, k) => {
  const e = 6 + 16 * k;
  const size = ico.readUInt32LE(e + 8);
  const off = ico.readUInt32LE(e + 12);
  return { w: ico[e] || 256, data: ico.subarray(off, off + size) };
});
check([16, 24, 32].every((n) => icoEntries.some((e) => e.w === n && e.data.equals(small(n)))), `r.6 icon.ico has 16, 24 and 32 px from the simplified variant (sizes: ${icoEntries.map((e) => e.w).join(", ")})`);
// .icns: icp4 (16), icp5 (32) and ic11 (16@2x = 32) are the simplified PNGs
const icns = bytes("src-tauri/icons/icon.icns");
const icnsEntries = new Map<string, ReturnType<typeof bytes>>();
for (let o = 8; o < icns.length; ) {
  const type = icns.subarray(o, o + 4).toString("latin1");
  const len = icns.readUInt32BE(o + 4);
  icnsEntries.set(type, icns.subarray(o + 8, o + len));
  o += len;
}
check(icnsEntries.get("icp4")?.equals(small(16)) === true && icnsEntries.get("icp5")?.equals(small(32)) === true && icnsEntries.get("ic11")?.equals(small(32)) === true, `r.6 icon.icns has 16 and 32 px from the simplified variant (types: ${[...icnsEntries.keys()].join(" ")})`);
check(bytes("ui/public/icon.png").equals(bytes("assets/icon/ns-1024.png")), "r.6 ui/public/icon.png is the 1024 px icon");
check(read("ui/public/icon.svg").includes("#CC1219") && (read("ui/public/icon.svg").match(/<circle/g) ?? []).length === 48, "r.6 ui/public/icon.svg: the NS of 48 dots on #CC1219");
check(read("ui/src/components/MenuBar.tsx").includes(`src="/icon-small.png"`) && bytes("ui/public/icon-small.png").equals(small(32)), "r.6 the 16 px mark in the title bar uses the simplified variant");

done("red look and NS icon (r.1–r.6)");
