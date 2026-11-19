// Modulo e — verifica di e.1–e.15 sull'interfaccia vera (Chromium, Playwright).
//
// Apre NOVAstitch come il giro del modulo i (server di Vite, motore vero in
// WebAssembly): il tessuto si sceglie dal selettore di Filum (barra del
// titolo), l'annulla con Ctrl+Z, gli avvisi si leggono nel pannello Problemi
// di Filum, calcolati sul piano dei punti vero. Gli oggetti si creano con le
// funzioni di Filum che usano i suoi strumenti di disegno (defaultStitch), così
// nascono con i valori dell'innesto del modulo 0.
//
// Uso (dalla radice del repository; prima: npm run wasm):
//   node ui/src/nova/presets/interfaccia.mjs
// Le foto vanno in NOVA_E_DIR, o in <tmp>/nova-e-interfaccia.

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, "../../../..");
const UI = path.join(REPO, "ui");
const OUT = process.env.NOVA_E_DIR ? path.resolve(process.env.NOVA_E_DIR) : path.join(tmpdir(), "nova-e-interfaccia");
mkdirSync(OUT, { recursive: true });
const { chromium } = createRequire(path.join(REPO, "package.json"))("playwright");

let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${msg}`);
  if (!ok) failed++;
};

const { createServer } = await import(pathToFileURL(path.join(UI, "node_modules/vite/dist/node/index.js")).href);
const server = await createServer({ root: UI, configFile: path.join(UI, "vite.config.ts"), server: { port: 0, hmr: false }, logLevel: "error", clearScreen: false });
await server.listen();
const browser = await chromium.launch();
const page = await (await browser.newContext({ locale: "it-IT", viewport: { width: 1600, height: 1000 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(server.resolvedUrls.local[0]);
await page.waitForSelector(".menu-btn", { timeout: 60000 });
await page.waitForTimeout(2000);

/** Runs `fn(m)` in the page with the app's modules in `m`. */
const run = (fn, arg) =>
  page.evaluate(
    async ({ src, arg }) => {
      const m = {
        ...(await import("/src/store.ts")),
        ...(await import("/src/lib/geometry.ts")),
        ...(await import("/src/lib/issues.ts")),
        ...(await import("/src/nova/core/commands.ts")),
      };
      return new Function("m", "arg", `return (${src})(m, arg)`)(m, arg);
    },
    { src: fn.toString(), arg },
  );
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
/** A new empty design, the Material panel open. */
const fresh = () =>
  run((m) => {
    m.useStore.setState({ doc: m.emptyDoc(), past: [], future: [], selection: [], inspectorTab: "design" });
  });
/** Objects made as Filum's tools make them: [id, kind, x, y, w, h, extra stitch values]. */
const add = (list) =>
  run((m, list) => {
    const rect = (x, y, w, h) => ({ closed: true, nodes: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map((p) => ({ p })) });
    const objs = list.map(([id, kind, x, y, w, h, extra, paths]) => ({
      id,
      name: id,
      thread: m.useStore.getState().doc.threads[0]?.id ?? "t1",
      visible: true,
      locked: false,
      trimAfter: false,
      stopAfter: false,
      paths: paths ?? (kind === "satin" ? [{ closed: false, nodes: [{ p: [x, y] }, { p: [x + w, y] }] }] : [rect(x, y, w, h)]),
      stitch: { ...m.defaultStitch(kind), ...(extra ?? {}) },
    }));
    m.useStore.getState().addObjects(objs);
  }, list);
const objects = () => run((m) => m.useStore.getState().doc.objects.map((o) => ({ id: o.id, stitch: o.stitch, edited: o.nova?.edited ?? [] })));
const by = async (id) => (await objects()).find((o) => o.id === id);
const docInfo = () => run((m) => ({ fabric: m.useStore.getState().doc.fabric, preset: m.useStore.getState().doc.nova?.fabricPreset ?? null, past: m.useStore.getState().past.length }));
const pick = async (fabric) => {
  await page.keyboard.press("Escape");
  try {
    await page.locator("select:has(option[value=knit])").first().selectOption(fabric, { timeout: 10000 });
  } catch (err) {
    await shot("errore-selettore");
    throw err;
  }
  await page.waitForTimeout(300);
};
/** The plan of the design as it is now (the engine in its worker). */
const planned = async () => {
  await page.waitForFunction(async () => {
    const s = (await import("/src/store.ts")).useStore.getState();
    return !s.planning && !!s.plan && s.plan.objects.length > 0;
  }, null, { timeout: 30000 });
  await page.waitForTimeout(500);
};
/** Issues shown in Filum's Issues panel: {id, objId, title} from the list, and the panel's text. */
const issuesPanel = async () => {
  await run((m) => m.useStore.setState({ outlineTab: "issues" }));
  await page.waitForTimeout(400);
  const list = await run((m) => m.computeIssues(m.useStore.getState().doc, m.useStore.getState().plan).map((i) => ({ id: i.id, objId: i.objId, title: i.title, at: i.at })));
  const text = await page.locator(".outline, .panel, aside").allInnerTexts().then((t) => t.join("\n"));
  return { list, text };
};
const e = (list, kind) => list.filter((i) => i.id.startsWith(`e.${kind}:`));

// ---- e.8: no preset → 0,25 mm between the tatami rows
await fresh();
await add([["t0", "fill", 10, 10, 20, 20]]);
check((await by("t0")).stitch.rowSpacing === 0.25 && (await docInfo()).preset === null, "e.8 senza preset: tatami a 0,25 mm tra le righe (Filum)");

// ---- e.1: Maglia from the picker, then a tatami is drawn
await fresh();
await pick("knit");
let d = await docInfo();
check(d.fabric === "knit" && d.preset?.id === "maglia", `e.1 il selettore del tessuto mette in vigore il preset «maglia» (${JSON.stringify(d.preset)})`);
await add([["t0", "fill", 10, 10, 20, 20]]);
let t0 = await by("t0");
check(t0.stitch.underlay === true && t0.stitch.underlayAngle === 90 && t0.stitch.pullComp === 1 && t0.stitch.expand === 0.4, "e.1 il tatami nuovo ha l'underlay perpendicolare e i valori del preset (trazione 1 mm, sovrapposizione 0,4 mm)");
await shot("e1-maglia");

// ---- e.2: Studio, underlay off by hand (as the stitch panel does)
await add([1, 2, 3, 4, 5].map((i) => [`t${i}`, "fill", 10 + 25 * (i % 3), 40 + 25 * Math.floor(i / 3), 20, 20]));
await run((m) => m.useStore.getState().updateStitch("t0", { underlay: false }));
t0 = await by("t0");
check(t0.stitch.underlay === false && t0.edited.includes("stitch.underlay"), `e.2 underlay tolto; nova.edited = ${JSON.stringify(t0.edited)}`);

// ---- e.3: another preset from the picker; one Ctrl+Z
const before = (await docInfo()).past;
await pick("cotton");
const all = await objects();
const five = all.filter((o) => /^t[1-5]$/.test(o.id));
check(five.length === 5 && five.every((o) => o.stitch.pullComp === 0 && o.stitch.expand === 0.2 && o.stitch.underlay === true), "e.3 i 5 tatami non toccati prendono i valori di «cotone»");
check(all.find((o) => o.id === "t0").stitch.underlay === false, "e.3 quello ritoccato resta senza underlay");
check((await docInfo()).past === before + 1, "e.3 un solo passo di annulla");
await page.locator("canvas").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
await page.keyboard.press("Control+z");
await page.waitForTimeout(300);
d = await docInfo();
check(d.fabric === "knit" && d.preset?.id === "maglia" && (await by("t1")).stitch.pullComp === 1, "e.3 Ctrl+Z una volta: tessuto e valori tornano a «maglia»");
await page.keyboard.press("Control+y");
await page.waitForTimeout(300);
if ((await docInfo()).fabric !== "cotton") await pick("cotton");

// ---- e.4: e.param.reset
await run((m) => m.runCommand("e.param.reset", { id: "t0", param: "stitch.underlay" }));
t0 = await by("t0");
check(t0.stitch.underlay === true && !t0.edited.includes("stitch.underlay"), "e.4 e.param.reset: underlay del preset in vigore, parametro tolto da nova.edited");

// ---- e.5: the shipped presets all loaded (none refused at start)
check(!errors.some((x) => /preset/i.test(x)) && (await run(async () => (await import("/src/nova/presets/install.ts")).refusedPresets().length)) === 0, "e.5 all'avvio nessun preset rifiutato");

// ---- e.6: every preset from the picker, a new tatami and satin have exactly the file's values
const fabrics = await run(async () => (await import("/src/nova/presets/registry.ts")).presetList().map((p) => ({ id: p.id, base: p.base, satin: p.satin ?? {}, fill: p.fill ?? {}, overlap: p.overlap.flat })));
for (const p of fabrics) {
  await fresh();
  await pick(p.base);
  await add([["f", "fill", 10, 10, 20, 20], ["s", "satin", 10, 50, 30, 0]]);
  const f = (await by("f")).stitch;
  const s = (await by("s")).stitch;
  const wrong = [...Object.entries(p.fill).filter(([k, v]) => f[k] !== v), ...Object.entries(p.satin).filter(([k, v]) => s[k] !== v)].map(([k]) => k);
  if (f.expand !== p.overlap) wrong.push("expand");
  check(wrong.length === 0, `e.6 ${p.id}: oggetti nuovi con i valori del file (${wrong.join(", ") || "tutti"})`);
}
check(fabrics.length === 13, `e.6 13 preset nel selettore (${fabrics.length})`);

// ---- e.9, e.10
await fresh();
await pick("cotton");
await add([["s3", "satin", 10, 50, 30, 0, { width: 3 }]]);
await run((m) => m.runCommand("e.preset.apply", { presetId: "cotone" }));
const s3 = (await by("s3")).stitch;
check(s3.contourUnderlay === true && s3.contourInset === 0.5, "e.9 satin da 3 mm: underlay di contorno a 0,5 mm dal bordo");
await fresh();
await pick("cotton");
await add([["p", "fill", 10, 10, 20, 20], ["q", "fill", 30, 10, 20, 20]]);
check((await objects()).every((o) => o.stitch.expand === 0.2), "e.10 tessuto stabile: expand 0,2 mm su entrambi (20,4 × 20,4 mm)");
await planned();
const bounds = await run((m) => {
  const { coords, objects, flags } = m.useStore.getState().plan;
  const b = {};
  for (let i = 0; i < objects.length; i++) {
    if (flags[i] & 31) continue;
    const o = objects[i];
    const x = coords[2 * i];
    b[o] = b[o] ? [Math.min(b[o][0], x), Math.max(b[o][1], x)] : [x, x];
  }
  return b;
});
check(bounds[0] && bounds[1] && bounds[0][1] > 30 && bounds[1][0] < 30, `e.10 sul piano vero i due tatami si sovrappongono (p fino a x ${bounds[0]?.[1].toFixed(2)}, q da x ${bounds[1]?.[0].toFixed(2)})`);
await pick("knit");
check((await objects()).every((o) => o.stitch.expand === 0.4), "e.10 su elastico: expand 0,4 mm (20,8 × 20,8 mm)");

// ---- warnings on the real plan, in the Issues panel
// e.7: satin 12 mm
await fresh();
await pick("cotton");
await add([["w", "satin", 10, 50, 40, 0, { width: 12 }]]);
await planned();
let ip = await issuesPanel();
check(ip.list.some((i) => i.objId === "w" && /largo|wide/i.test(i.title)), `e.7 satin da 12 mm: «${ip.list.find((i) => i.objId === "w" && /largo|wide/i.test(i.title))?.title}»`);

// e.11: satin 0,15 mm, filo n. 40
await fresh();
await pick("cotton");
await add([["fitto", "satin", 10, 50, 40, 0, { spacing: 0.15 }]]);
await planned();
ip = await issuesPanel();
check(e(ip.list, "dense").length === 1 && ip.text.includes("Punti troppo fitti per filo e tessuto"), "e.11 «Punti troppo fitti per filo e tessuto» nel pannello Problemi");
await shot("e11-pannello");

// e.12: maglia, due tatami adiacenti che cuciono uno verso l'altro
await fresh();
await pick("knit");
await add([["A", "fill", 10, 10, 20, 20, { angle: 0 }], ["B", "fill", 10, 30, 20, 20, { angle: 0 }]]);
await run((m) => {
  const s = m.useStore.getState();
  // B from its bottom edge to its top edge: towards A (A sews downwards, towards B)
  s.setDoc({ ...s.doc, objects: s.doc.objects.map((o) => (o.id === "B" ? { ...o, start: [20, 50], end: [20, 30] } : o)) });
});
await planned();
ip = await issuesPanel();
const facing = e(ip.list, "facing").map((i) => i.objId).sort().join();
check(facing === "A,B", `e.12 avviso sui due tatami che cuciono uno verso l'altro (${facing || "nessuno"})`);
await shot("e12-maglia");
await run((m) => {
  const s = m.useStore.getState();
  s.setDoc({ ...s.doc, objects: s.doc.objects.map((o) => (o.id === "B" ? { ...o, start: undefined, end: undefined } : o)) });
});
await planned();
ip = await issuesPanel();
check(e(ip.list, "facing").length === 0, "e.12 gli stessi due tatami cuciti nello stesso verso: nessun avviso");

// e.13: satin con solo zigzag
await fresh();
await pick("cotton");
await add([["z", "satin", 10, 50, 40, 0, { width: 1.5, zigzagUnderlay: true, contourUnderlay: false }]]);
await planned();
ip = await issuesPanel();
check(e(ip.list, "zigzagOnly").length === 1, "e.13 satin con underlay a zigzag e senza contorno: avviso");

// e.14: maglia, forma A, forma B, poi il contorno di A
await fresh();
await pick("knit");
await add([
  ["A", "fill", 10, 10, 20, 20],
  ["B", "fill", 50, 10, 20, 20],
  ["contorno A", "running", 0, 0, 0, 0, null, [{ closed: true, nodes: [[10, 10], [30, 10], [30, 30], [10, 30]].map((p) => ({ p })) }]],
]);
await planned();
ip = await issuesPanel();
check(e(ip.list, "contourOrder").map((i) => i.objId).join() === "contorno A", "e.14 avviso: il contorno di A va cucito subito dopo A");

// e.15: riempimento curvo in una forma che si stringe a 2 mm
await fresh();
await pick("cotton");
await add([["curvo", "fill", 0, 0, 0, 0, { method: "curved", rowSpacing: 0.4, curve: 1, angle: 0 }, [{ closed: true, nodes: [[10, 10], [60, 19], [60, 21], [10, 30]].map((p) => ({ p })) }]]]);
await planned();
ip = await issuesPanel();
const narrow = e(ip.list, "narrowRows")[0];
check(!!narrow, `e.15 righe sotto la distanza impostata nella parte stretta: avviso con la posizione (${narrow ? narrow.at.map((v) => v.toFixed(1)).join(", ") : "nessuno"})`);
await shot("e15-curvo");

// ---- the preset card under the fabric picker (space «material» of module 0)
await fresh();
await pick("knit");
const card = page.locator('[data-nova-slot="material"] [data-nova-anchor="e.presetCard"]');
await card.waitFor({ timeout: 10000 }).catch(() => {});
const cardText = (await card.count()) ? await card.innerText() : "";
check(/Maglia \/ Jersey/.test(cardText) && /Da tagliare, medio/.test(cardText) && /Tonda/.test(cardText) && /non si stirano/.test(cardText), `scheda del preset sotto il selettore del tessuto: «${cardText.split("\n").slice(0, 3).join(" · ")}…»`);
check((await page.locator('[aria-modal="true"]').count()) === 0, "la scheda non blocca il lavoro (nessuna finestra modale)");
await shot("scheda-preset");
await page.locator('[data-nova-anchor="e.presetCard.close"]').click();
await page.waitForTimeout(200);
check((await card.count()) === 0, "la scheda si chiude con la ×");
await pick("cotton");
await card.waitFor({ timeout: 5000 }).catch(() => {});
check((await card.count()) === 1 && /Cotone/.test(await card.innerText()), "con un altro preset la scheda torna");

// ---- the summary in the export dialog (space «export» of module 0)
await fresh();
await pick("cotton");
await add([["ap", "applique", 10, 10, 20, 20]]);
await run((m) => m.useStore.getState().setDialog("export"));
const summary = page.locator('[data-nova-slot="export"] [data-nova-anchor="e.exportSummary"]');
await summary.waitFor({ timeout: 10000 }).catch(() => {});
const sumText = (await summary.count()) ? await summary.innerText() : "";
check(/Prima di ricamare/.test(sumText) && /Cotone/.test(sumText) && /Strappabile, medio/.test(sumText) && /APPLIQUÉ/.test(sumText), `riepilogo nella finestra di esportazione: «${sumText.split("\n").join(" · ")}»`);
await shot("riepilogo-esportazione");
await page.locator('[data-nova-anchor="e.exportSummary.close"]').click();
await page.waitForTimeout(200);
check((await summary.count()) === 0 && (await page.locator(".dialog, [role=dialog]").count()) > 0, "il riepilogo si chiude con la ×; la finestra di esportazione resta aperta");
await run((m) => m.useStore.getState().setDialog(null));

check(errors.length === 0, `nessun errore nella pagina (${errors.join("; ") || "nessuno"})`);
await browser.close();
await server.close();
console.log(`foto in ${OUT}`);
if (failed) {
  console.error(`${failed} controlli falliti`);
  process.exit(1);
}
