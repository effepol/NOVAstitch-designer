// Le immagini del README (docs/screenshots/*.png), interfaccia in italiano,
// tema scuro, finestra 1600×1000. Si rifanno a ogni versione:
//
//   npm run wasm --prefix ui                    # il motore, se non c'è già
//   node docs/tools/screenshots-readme.mjs      # tutte e tre
//   node docs/tools/screenshots-readme.mjs tela-satin   # solo alcune
//
// Come il giro del modulo i (ui/src/nova/i18n/filum/giro.mjs): avvia da sé il
// server di sviluppo e apre NOVAstitch in Chromium (Playwright del repository)
// con il sistema in italiano. Ogni immagine parte da un profilo nuovo.
//
//   tela-satin.png             un satin a due binari disegnato con lo strumento
//                              del modulo m (clic veri sulla tela), con i punti
//   sequenza-collegamenti.png  il pannello Sequenza (modulo b) con «Partenza e
//                              arrivo» e «Collegamenti» accesi, su 4 oggetti
//                              del disegno d'esempio
//   scheda-di-lavoro.png       la prima pagina della scheda di lavoro PDF
//                              (modulo l) del disegno d'esempio intero, in immagine
//
// La pagina del PDF si converte con pdftoppm (poppler-utils). Ogni PNG deve
// stare sotto 400 KB: se no lo script fallisce.

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const UI = path.join(REPO, "ui");
const OUT = path.join(REPO, "docs", "screenshots");
const W = 1600;
const H = 1000;
const MAX_BYTES = 400 * 1024;

const { chromium } = createRequire(path.join(REPO, "package.json"))("playwright");

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

/** Esegue `body` nella pagina con s = stato del negozio, useStore e a = argomenti. */
const run = (p, body, ...a) =>
  p.evaluate(
    async ([body, a]) => {
      const { useStore } = await import("/src/store.ts");
      // eslint-disable-next-line no-new-func
      return new Function("s", "useStore", "a", body)(useStore.getState(), useStore, a);
    },
    [body, a],
  );

/** Aspetta che il piano dei punti sia pronto. */
async function waitPlan(p) {
  for (let i = 0; i < 120; i++) {
    if (await run(p, "return !s.planning && !!s.plan")) return;
    await p.waitForTimeout(250);
  }
  throw new Error("il piano dei punti non arriva");
}

/** Il rettangolo della tela sullo schermo. */
const canvasBox = (p) => p.locator("canvas.layer-bg").boundingBox();

// --- le immagini ---------------------------------------------------------------

/** 1) Un satin a due binari disegnato con lo strumento del modulo m, punti visibili. */
async function telaSatin(p) {
  await p.evaluate(async () => {
    const m = await import("/src/store.ts");
    m.useStore.getState().setDoc(m.emptyDoc());
  });
  await p.waitForTimeout(500);
  // sulla tela vuota le schede «Inizia un disegno» prenderebbero i clic: via finché si disegna
  // (spariscono comunque col primo oggetto)
  await p.addStyleTag({ content: ".empty-hint { display: none !important; }" });
  await p.locator(`[title^="Satin a due binari"]`).first().click();
  await p.waitForTimeout(300);
  const box = await canvasBox(p);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // una fascia a S: binario 1 sopra, binario 2 sotto, clic alternati;
  // il clic destro fa un punto curvo, il sinistro un punto dritto
  const N = 7;
  const span = Math.min(box.width * 0.55, 760);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const x = cx - span / 2 + u * span;
    const mid = cy + Math.sin(u * Math.PI * 2) * 110;
    const half = 34 + 16 * Math.sin(u * Math.PI);
    const button = i === 0 || i === N - 1 ? "left" : "right";
    await p.mouse.click(x, mid - half, { button });
    await p.waitForTimeout(80);
    await p.mouse.click(x, mid + half, { button });
    await p.waitForTimeout(80);
  }
  await p.keyboard.press("Enter");
  await p.waitForTimeout(400);
  const n = await run(p, "return s.doc.objects.length");
  if (n !== 1) throw new Error(`tela-satin: lo strumento non ha creato il satin (${n} oggetti)`);
  await run(p, `s.setTool("select"); s.select([]); s.setViewMode("stitch")`);
  await waitPlan(p);
  await p.mouse.move(box.x + 10, box.y + box.height - 10);
}

/**
 * Gli oggetti del disegno d'esempio che restano nell'immagine 2: 4, gli ultimi due con
 * lo stesso filo (fra due colori c'è sempre il rasafilo; salto e cucitura solo sullo stesso filo).
 */
const KEEP = ["Cielo", "Montagne", "Cime innevate", "Nuvola"];

/** Il disegno d'esempio ridotto a KEEP, con i soli fili usati. */
async function fourObjects(p) {
  const n = await run(
    p,
    `const d = s.doc;
     const objects = d.objects.filter((o) => a[0].includes(o.name));
     const used = new Set(objects.map((o) => o.thread));
     s.setDoc({ ...d, objects, threads: d.threads.filter((t) => used.has(t.id)) });
     return objects.length;`,
    KEEP,
  );
  if (n !== KEEP.length) throw new Error(`il disegno d'esempio non ha più gli oggetti ${KEEP.join(", ")} (trovati ${n})`);
  await p.waitForTimeout(300);
}

/** 2) Il pannello Sequenza con «Partenza e arrivo» e «Collegamenti» accesi. */
async function sequenza(p) {
  await fourObjects(p);
  await p.locator(`button:has-text("Sequenza"), [role=tab]:has-text("Sequenza")`).first().click();
  await p.waitForTimeout(400);
  // i due pulsanti del modulo b stanno nella barra in basso, o nel suo menu «Altro»
  for (const name of ["Partenza e arrivo", "Collegamenti"]) {
    const inBar = p.locator(`.bottombar button:has-text("${name}")`).first();
    if (await inBar.isVisible().catch(() => false)) await inBar.click();
    else {
      await p.locator(".bb-overflow").click();
      await p.locator(`.bb-overflow-menu :text-is("${name}")`).first().click();
    }
    await p.waitForTimeout(300);
  }
  // i collegamenti scelti dal programma sono tenui: due scelti a mano dal menu della loro riga,
  // il rasafilo dopo il cielo (rosso) e il salto fra le cime e la nuvola, sullo stesso filo (blu);
  // quello fra le montagne e le cime resta del programma (tenue)
  for (const [row, choice] of [[0, "Rasafilo"], [2, "Salto"]]) {
    await p.locator(`[title^="Dopo:"]`).nth(row).click();
    await p.waitForTimeout(200);
    await p.locator(`[role=menu] :text-is("${choice}")`).first().click();
    await p.waitForTimeout(300);
  }
  const on = await p.evaluate(async () => {
    const v = await import("/src/nova/sequence/view.ts");
    return v.isOn("startEnd") && v.isOn("links");
  });
  if (!on) throw new Error("sequenza: «Partenza e arrivo» e «Collegamenti» non si sono accesi");
  await run(p, `s.setViewMode("vector")`);
  await waitPlan(p);
  const box = await canvasBox(p);
  await p.mouse.move(box.x + 10, box.y + box.height - 10);
}

/** 3) La prima pagina della scheda di lavoro PDF del disegno d'esempio intero. */
async function scheda(p, file) {
  await waitPlan(p);
  const bytes = await p.evaluate(async () => {
    const { useStore, planOf } = await import("/src/store.ts");
    const { engine } = await import("/src/engine/client.ts");
    const { sheetData } = await import("/src/nova/worksheet/sheetData.ts");
    const { sheetPdf } = await import("/src/nova/worksheet/pdf.ts");
    const doc = useStore.getState().doc;
    const plan = planOf.get(doc) ?? (await engine.plan(doc));
    return [...(await sheetPdf(sheetData(doc, plan, `${doc.name}.dst`), plan))];
  });
  const dir = mkdtempSync(path.join(tmpdir(), "nova-scheda-"));
  try {
    const pdf = path.join(dir, "scheda.pdf");
    writeFileSync(pdf, Uint8Array.from(bytes));
    // la prima pagina, alta 1000 punti come le altre immagini
    execFileSync("pdftoppm", ["-png", "-f", "1", "-l", "1", "-singlefile", "-scale-to-y", String(H), "-scale-to-x", "-1", pdf, path.join(dir, "p")]);
    execFileSync("cp", [path.join(dir, "p.png"), file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const SHOTS = {
  "tela-satin": { make: telaSatin },
  "sequenza-collegamenti": { make: sequenza },
  "scheda-di-lavoro": { make: scheda, file: true },
};

// --- il giro -----------------------------------------------------------------

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(SHOTS);
for (const n of names) if (!SHOTS[n]) throw new Error(`immagine sconosciuta: ${n} (${Object.keys(SHOTS).join(", ")})`);

mkdirSync(OUT, { recursive: true });
const server = await startServer();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const failures = [];
try {
  for (const name of names) {
    const context = await browser.newContext({ locale: "it-IT", viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: "dark" });
    await context.addInitScript(() => localStorage.setItem("filum.theme", "dark"));
    const p = await context.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(url);
    await p.waitForSelector(".menu-btn", { timeout: 60000 });
    await p.waitForTimeout(3000);
    const lang = await p.evaluate(() => document.documentElement.lang);
    if (lang !== "it") throw new Error(`${name}: l'interfaccia non è in italiano (lang=${lang})`);
    const file = path.join(OUT, `${name}.png`);
    const shot = SHOTS[name];
    if (shot.file) await shot.make(p, file);
    else {
      await shot.make(p);
      await p.waitForTimeout(800);
      await p.screenshot({ path: file });
    }
    const size = statSync(file).size;
    console.log(`${name}.png  ${Math.round(size / 1024)} KB`);
    if (size >= MAX_BYTES) failures.push(`${name}.png pesa ${Math.round(size / 1024)} KB (massimo 400)`);
    if (errors.length) failures.push(`${name}: errori nella pagina: ${errors.join("; ")}`);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) {
  for (const f of failures) console.error(`FAIL ${f}`);
  process.exit(1);
}
console.log(`immagini in ${path.relative(REPO, OUT)}/`);
