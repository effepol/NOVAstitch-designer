// Modulo i — il «giro»: test i.1, i.3, i.4 sull'interfaccia vera.
//
// Apre NOVAstitch in Chromium (Playwright) e, una schermata dopo l'altra, apre
// ogni menu e sottomenu, i menu del tasto destro, ogni strumento, i pannelli per
// ogni tipo di oggetto e ogni finestra, con le loro schede. Da ogni schermata
// raccoglie le scritte visibili (testo, title, placeholder, aria-label, alt,
// voci delle tendine) e fa una foto.
//
//   i.4  sistema in italiano, primo avvio (nessuna scelta salvata) → lingua italiana
//   i.1  in italiano nessuna scritta inglese, nelle aree già tradotte (aree.json)
//   i.3  in inglese ogni schermata ha le stesse scritte di Filum 0.2.1
//        (riferimento-en-0.2.1.json, raccolto con --riferimento prima del modulo i)
//
// Le cifre sono sostituite da # prima del confronto: contano le parole, non i numeri.
// Le foto e un foglio riassuntivo (foglio.html) vanno in NOVA_GIRO_DIR, o in
// <tmp>/nova-giro-filum.
//
// Uso (dalla radice del repository; prima: npm run wasm):
//   node ui/src/nova/i18n/filum/giro.mjs                  i.1, i.3, i.4
//   node ui/src/nova/i18n/filum/giro.mjs --tutte-le-aree  i.1 su tutte le aree (fallisce finché non sono tradotte)
//   node ui/src/nova/i18n/filum/giro.mjs --riferimento [--ui <cartella ui di Filum 0.2.1>]
// Con NOVA_SALTA_GIRO=1 non fa nulla (su GitHub il giro ha un passo suo).

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, "../../../../..");
const RIFERIMENTO = path.join(here, "riferimento-en-0.2.1.json");
const args = process.argv.slice(2);
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);

if (process.env.NOVA_SALTA_GIRO === "1") {
  console.log("giro: saltato (NOVA_SALTA_GIRO=1)");
  process.exit(0);
}

const UI = path.resolve(arg("--ui") ?? path.join(REPO, "ui"));
const OUT = process.env.NOVA_GIRO_DIR ? path.resolve(process.env.NOVA_GIRO_DIR) : path.join(tmpdir(), "nova-giro-filum");

/** Playwright dal repository, altrimenti quello installato sulla macchina (NODE_PATH). */
function loadPlaywright() {
  const require = createRequire(path.join(REPO, "package.json"));
  try {
    return require("playwright");
  } catch {
    for (const p of (process.env.NODE_PATH ?? "").split(path.delimiter).filter(Boolean))
      try {
        return require(require.resolve("playwright", { paths: [p] }));
      } catch {
        /* il prossimo */
      }
    throw new Error("giro: Playwright non trovato (npm ci alla radice del repository)");
  }
}

/** Dove stanno le finestre: le finestre di Filum, la ricerca comandi, gli sfondi a schermo intero. */
const DIALOG = ".dialog, [role=dialog], .backdrop";
const json = (f) => JSON.parse(readFileSync(path.join(here, f), "utf8"));
const norm = (s) => s.replace(/\d+(?:[.,  ]\d+)*/g, "#");

// --- nella pagina ------------------------------------------------------------

/** Le scritte visibili dentro `root` (selettore CSS; senza corrispondenze, tutta la pagina). */
function collectTexts(root) {
  const out = new Set();
  const add = (s) => {
    const v = (s ?? "").replace(/\s+/g, " ").trim();
    if (v && /\p{L}/u.test(v)) out.add(v);
  };
  const seen = (el) => el.checkVisibility({ visibilityProperty: true });
  const roots = root === "body" ? [document.body] : [...document.querySelectorAll(root)].filter(seen);
  if (!roots.length) return null;
  for (const r of roots) {
    const walker = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const el = walker.currentNode.parentElement;
      if (el && !el.closest("script,style") && seen(el)) add(walker.currentNode.textContent);
    }
    const all = (sel) => [...(r.matches(sel) ? [r] : []), ...r.querySelectorAll(sel)];
    for (const el of all("[title],[placeholder],[aria-label],[alt]"))
      if (seen(el)) for (const a of ["title", "placeholder", "aria-label", "alt"]) add(el.getAttribute(a));
    for (const o of all("select option")) if (seen(o.closest("select"))) add(o.textContent);
    for (const i of all("input[type=button],input[type=submit]")) if (seen(i)) add(i.value);
  }
  if (root === "body") add(document.title);
  return [...out];
}

// --- il giro -----------------------------------------------------------------

async function startServer() {
  const { createServer } = await import(pathToFileURL(path.join(UI, "node_modules/vite/dist/node/index.js")).href);
  const server = await createServer({
    root: UI,
    configFile: path.join(UI, "vite.config.ts"),
    server: { port: 0, strictPort: false, hmr: false },
    logLevel: "error",
    clearScreen: false,
  });
  await server.listen();
  return server;
}

/**
 * Un giro completo in una lingua. Restituisce {lang, schermate: {id: [scritte]}}.
 * Gli id delle schermate non dipendono dalla lingua (indici, nomi interni).
 */
async function tour(browser, url, locale, shots) {
  const context = await browser.newContext({ locale, viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector(".menu-btn", { timeout: 60000 });
  await page.waitForTimeout(3000);

  const lang = await page.evaluate(() => document.documentElement.lang);
  const screens = {};
  const missing = [];
  let n = 0;

  const settle = (ms = 350) => page.waitForTimeout(ms);
  const store = (fn, arg) =>
    page.evaluate(
      async ({ src, arg }) => {
        const { useStore } = await import("/src/store.ts");
        // eslint-disable-next-line no-new-func
        return new Function("s", "arg", `return (${src})(s, arg)`)(useStore.getState(), arg);
      },
      { src: fn.toString(), arg },
    );
  const call = (mod, name, ...a) =>
    page.evaluate(async ({ mod, name, a }) => (await import(mod))[name](...a), { mod, name, a });

  /** Riporta l'interfaccia allo stato di partenza. */
  const reset = async () => {
    await page.keyboard.press("Escape");
    await page.mouse.click(2, 998).catch(() => {});
    await store((s) => {
      s.setDialog(null);
      s.setTool("select");
      s.select([]);
    });
    await settle(150);
  };
  /** Apre ogni sezione chiusa dei pannelli (anche quelle annidate). */
  const openSections = async (root) => {
    for (let round = 0; round < 6; round++) {
      const closed = page.locator(`:is(${root}) .section:not(.open) > .section-head > .section-title:visible`);
      const k = await closed.count();
      if (!k) break;
      for (let i = k - 1; i >= 0; i--) await closed.nth(i).click({ timeout: 2000 }).catch(() => {});
      await settle(150);
    }
  };
  const record = async (id, root = "body") => {
    if (root !== ".menu") await openSections(root);
    // i calcoli in corso («Working…») cambiano le scritte: si aspetta che restino ferme
    let texts = await page.evaluate(collectTexts, root);
    for (let i = 0; i < 40; i++) {
      await settle(250);
      const again = await page.evaluate(collectTexts, root);
      const same = JSON.stringify(again) === JSON.stringify(texts);
      texts = again;
      if (same && !(texts ?? []).some((t) => /^(Working|Counting|Lavor|Calcol|Conteg)[^]*…$/.test(t))) break;
    }
    if (!texts) missing.push(id);
    screens[id] = [...new Set((texts ?? []).map(norm))].sort();
    if (shots) await page.screenshot({ path: path.join(shots, `${String(++n).padStart(3, "0")}.png`) }).catch(() => {});
    if (shots) screens[id + "\u0000shot"] = n;
  };
  /** Registra la schermata e poi, una per una, le sue schede ([role=tab]) dentro `root`. */
  const recordWithTabs = async (id, root = "body") => {
    await record(id, root);
    const tabs = page.locator(`:is(${root}) [role=tab]:visible`);
    const k = await tabs.count();
    for (let i = 0; i < k; i++) {
      if ((await tabs.nth(i).getAttribute("aria-selected")) === "true") continue;
      await tabs.nth(i).click({ timeout: 2000 }).catch(() => {});
      await settle();
      await record(`${id}#scheda${i}`, root);
    }
  };

  const objects = await store((s) => s.doc.objects.map((o) => ({ id: o.id, type: o.stitch.type })));
  const firstOf = (type) => objects.find((o) => o.type === type)?.id;
  const fill = firstOf("fill");

  // avvio: i.4
  await record("avvio");

  // menu della barra, con un oggetto selezionato (voci attive); sottomenu ricorsivi
  await store((s, id) => s.select([id]), fill);
  await settle();
  const menuCount = await page.locator(".menu-btn").count();
  for (let i = 0; i < menuCount; i++) {
    await page.locator(".menu-btn").nth(i).dispatchEvent("pointerdown");
    await page.locator(".menu").first().waitFor({ timeout: 5000 });
    await settle(200);
    const walkMenu = async (id, depth) => {
      await record(id, ".menu");
      const level = page.locator(".menu").nth(depth);
      const items = level.locator(":scope > .menu-item");
      const k = await items.count();
      for (let j = 0; j < k; j++) {
        const it = items.nth(j);
        if (!(await it.evaluate((el) => el.classList.contains("has-sub") && !el.disabled))) continue;
        await it.hover();
        await page.locator(".menu").nth(depth + 1).waitFor({ timeout: 5000 });
        await settle(200);
        await walkMenu(`${id}/${j}`, depth + 1);
      }
    };
    await walkMenu(`menu/${i}`, 0);
    await page.keyboard.press("Escape");
    await settle(150);
  }
  await reset();

  // menu del tasto destro sulla tela: su un oggetto e sul vuoto
  const canvas = page.locator(".canvas-wrap");
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
    await settle();
    await record("contesto/oggetto", ".menu");
    await reset();
    await page.mouse.click(box.x + 20, box.y + box.height - 20, { button: "right" });
    await settle();
    await record("contesto/vuoto", ".menu");
    await reset();
  }

  // strumenti
  const tools = ["select", "node", "pan", "ruler", "pen", "curve", "freehand", "satin", "rect", "ellipse", "text", "cut", "gradient", "builder", "guides"];
  for (const t of tools) {
    await store((s, t) => s.setTool(t), t);
    await settle();
    await record(`strumento/${t}`);
  }
  await reset();

  // pannelli: impostazioni del disegno, poi un oggetto per tipo di punto, poi più oggetti
  await store((s) => s.select([]));
  await page.evaluate(async () => (await import("/src/store.ts")).useStore.setState({ inspectorTab: "design" }));
  await settle();
  await recordWithTabs("pannello/disegno");
  for (const type of [...new Set(objects.map((o) => o.type))].sort()) {
    await store((s, id) => s.select([id]), firstOf(type));
    await settle(600);
    await recordWithTabs(`pannello/oggetto/${type}`);
  }
  await store((s, ids) => s.select(ids), objects.map((o) => o.id));
  await settle(600);
  await record("pannello/oggetti");
  await reset();

  // finestre, con un riempimento selezionato
  const dialogs = ["calibrate", "swatches", "crossstitch", "palette", "knockdown", "route", "export", "digitize", "fonts", "threads", "production", "shortcuts", "about", "licenses", "repeat", "outline", "effects", "convert", "settings", "threadlist", "rebuild"];
  const dialog = async (id, open) => {
    await reset();
    await store((s, id) => s.select([id]), fill);
    await open();
    await settle(900);
    await recordWithTabs(id, DIALOG);
  };
  for (const d of dialogs) await dialog(`finestra/${d}`, () => store((s, d) => s.setDialog(d), d));
  for (const tab of ["appearance", "canvas", "export", "threads", "digitizer", "downloads", "files", "keys"])
    await dialog(`finestra/settings/${tab}`, () => store((s, tab) => s.openSettings(tab), tab));
  for (const id of ["fillToSatin", "fillToStroke", "satinToStroke", "satinToRails", "zigzagToSatin", "patternSatin", "breakApart", "dedupe", "connectLines"])
    await dialog(`finestra/convert/${id}`, () => call("/src/components/ConvertTools.tsx", "openConvert", id));
  for (const id of ["corners", "pucker", "zigzag", "roughen", "twist", "warp", "simplify", "smooth", "anchors"])
    await dialog(`finestra/effects/${id}`, () => call("/src/components/ShapeEffects.tsx", "openEffect", id));
  for (const tab of ["running", "satin", "jumps"]) await dialog(`finestra/route/${tab}`, () => call("/src/components/RouteDialog.tsx", "openRoute", tab));
  await reset();

  await context.close();
  return { lang, screens, errors, missing };
}

// --- confronti ---------------------------------------------------------------

const shotsOf = (screens) => Object.fromEntries(Object.entries(screens).filter(([k]) => k.includes("\u0000")).map(([k, v]) => [k.split("\u0000")[0], v]));
const textsOf = (screens) => Object.fromEntries(Object.entries(screens).filter(([k]) => !k.includes("\u0000")));

/** L'area di una schermata, per i.1 durante la traduzione. */
const areaOf = (id) =>
  id.startsWith("menu/") || id.startsWith("contesto/") ? "menu" : id.startsWith("strumento/") || id === "avvio" ? "barre" : id.startsWith("pannello/") ? "pannelli" : "finestre";

function sheet(file, title, runs) {
  const rows = runs
    .flatMap(({ lang, dir, screens, bad }) =>
      Object.keys(screens).map(
        (id) =>
          `<figure class="${bad[id]?.length ? "bad" : ""}"><img loading="lazy" src="${lang}/${String(screens[id]).padStart(3, "0")}.png"><figcaption><b>${lang}</b> ${id}${bad[id]?.length ? `<br>${bad[id].map((s) => s.replace(/</g, "&lt;")).join(" · ")}` : ""}</figcaption></figure>`,
      ),
    )
    .join("\n");
  writeFileSync(
    file,
    `<!doctype html><meta charset="utf-8"><title>${title}</title><style>body{font:13px system-ui;margin:16px}figure{display:inline-block;width:400px;margin:6px;vertical-align:top}img{width:100%;border:1px solid #ccc}.bad img{border:3px solid #d00}figcaption{word-break:break-word}</style><h1>${title}</h1>${rows}`,
  );
}

// --- main --------------------------------------------------------------------

const { chromium } = loadPlaywright();
rmSync(OUT, { recursive: true, force: true });
const server = await startServer();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
let failed = 0;
const fail = (msg) => {
  failed++;
  console.log(`FAIL ${msg}`);
};
try {
  if (args.includes("--riferimento")) {
    const dir = path.join(OUT, "en");
    mkdirSync(dir, { recursive: true });
    const run = await tour(browser, url, "en-US", dir);
    if (run.missing.length) throw new Error(`giro: schermate non trovate: ${run.missing.join(", ")}`);
    let commit = "?";
    try {
      commit = execFileSync("git", ["-C", UI, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    } catch {
      /* fuori da git */
    }
    // compatto: le scritte una volta sola, le schermate come indici
    const screens = textsOf(run.screens);
    const testi = [...new Set(Object.values(screens).flat())].sort();
    const index = new Map(testi.map((t, i) => [t, i]));
    const body = Object.entries(screens).map(([id, l]) => `  ${JSON.stringify(id)}: [${l.map((t) => index.get(t)).join(",")}]`);
    writeFileSync(
      RIFERIMENTO,
      `{\n "_nota": "Scritte di Filum 0.2.1 in inglese, raccolte da giro.mjs --riferimento sul commit 'origine', prima che il modulo i cambiasse i testi. Ogni schermata elenca gli indici delle sue scritte in 'testi'. Cifre sostituite da #.",\n "origine": ${JSON.stringify(commit)},\n "testi": ${JSON.stringify(testi, null, 1).replace(/\n/g, "\n ")},\n "schermate": {\n${body.join(",\n")}\n }\n}\n`,
    );
    console.log(`giro: riferimento scritto (${Object.keys(textsOf(run.screens)).length} schermate) → ${path.relative(process.cwd(), RIFERIMENTO)}`);
  } else {
    const saved = JSON.parse(readFileSync(RIFERIMENTO, "utf8"));
    const ref = Object.fromEntries(Object.entries(saved.schermate).map(([id, l]) => [id, l.map((i) => saved.testi[i])]));
    const aree = json("aree.json").aree;
    const allowed = new Set(Object.keys(json("non-tradurre.json").testi).map(norm));
    const allAreas = args.includes("--tutte-le-aree");
    const done = (id) => allAreas || aree[areaOf(id)]?.fatta;
    const runs = [];

    // i.4 e i.1: sistema in italiano, primo avvio
    const itDir = path.join(OUT, "it");
    mkdirSync(itDir, { recursive: true });
    const it = await tour(browser, url, "it-IT", itDir);
    if (it.lang !== "it") fail(`i.4 sistema in italiano, primo avvio: la lingua è "${it.lang}", non "it"`);
    else console.log("ok   i.4 sistema in italiano, primo avvio → lingua italiana");
    const itBad = {};
    for (const [id, texts] of Object.entries(textsOf(it.screens))) {
      if (!done(id) || !ref[id]) continue;
      const english = new Set(ref[id]);
      const left = texts.filter((s) => english.has(s) && !allowed.has(s));
      if (left.length) itBad[id] = left;
    }
    const itCount = Object.values(itBad).flat().length;
    if (itCount) fail(`i.1 ${itCount} scritte inglesi in ${Object.keys(itBad).length} schermate in italiano:\n` + Object.entries(itBad).map(([id, l]) => `       ${id}: ${l.slice(0, 12).join(" · ")}${l.length > 12 ? " …" : ""}`).join("\n"));
    else console.log(`ok   i.1 nessuna scritta inglese nelle schermate in italiano (aree: ${allAreas ? "tutte" : Object.keys(aree).filter((a) => aree[a].fatta).join(", ") || "nessuna"})`);
    if (!itBad.avvio && aree.barre.fatta) console.log("ok   i.4 la prima schermata è in italiano");
    runs.push({ lang: "it", screens: shotsOf(it.screens), bad: itBad });

    // i.3: in inglese, le stesse scritte di Filum 0.2.1
    const enDir = path.join(OUT, "en");
    mkdirSync(enDir, { recursive: true });
    const en = await tour(browser, url, "en-US", enDir);
    const enBad = {};
    const now = textsOf(en.screens);
    for (const id of new Set([...Object.keys(ref), ...Object.keys(now)])) {
      const a = new Set(ref[id] ?? []);
      const b = new Set(now[id] ?? []);
      const diff = [...[...a].filter((s) => !b.has(s)).map((s) => `− ${s}`), ...[...b].filter((s) => !a.has(s)).map((s) => `+ ${s}`)];
      if (!(id in ref)) diff.unshift("(schermata nuova)");
      if (!(id in now)) diff.unshift("(schermata sparita)");
      if (diff.length) enBad[id] = diff;
    }
    const enCount = Object.keys(enBad).length;
    if (enCount) fail(`i.3 ${enCount} schermate in inglese diverse da Filum 0.2.1:\n` + Object.entries(enBad).map(([id, l]) => `       ${id}: ${l.slice(0, 12).join(" · ")}${l.length > 12 ? " …" : ""}`).join("\n"));
    else console.log(`ok   i.3 in inglese ogni schermata è identica a Filum 0.2.1 (${Object.keys(ref).length} schermate)`);
    runs.push({ lang: "en", screens: shotsOf(en.screens), bad: enBad });

    for (const r of [it, en]) for (const e of [...new Set(r.errors)]) console.log(`     errore nella pagina (${r.lang}): ${e}`);
    for (const r of [it, en]) if (r.missing.length) fail(`giro (${r.lang}): schermate non trovate: ${r.missing.join(", ")}`);
    sheet(path.join(OUT, "foglio.html"), "Giro di Filum — italiano e inglese", runs);
    writeFileSync(path.join(OUT, "risultato.json"), JSON.stringify({ it: { lang: it.lang, schermate: textsOf(it.screens), inglese: itBad }, en: { schermate: now, differenze: enBad } }, null, 1));
    console.log(`giro: foto e foglio riassuntivo in ${path.join(OUT, "foglio.html")}`);
  }
} finally {
  await browser.close();
  await server.close();
}
if (failed) {
  console.error(`giro: ${failed} controlli falliti`);
  process.exit(1);
}
