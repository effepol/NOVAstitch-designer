// Modulo i, test i.2: nei file di Filum nessun testo visibile scritto a mano.
// Ogni testo che l'utente vede passa da t("filum.<area>.<chiave>").
//
// Che cosa conta come testo visibile (con almeno una lettera):
//   - testo fra i tag JSX:                <span>Animate</span>
//   - stringhe dentro i figli JSX:        {open ? "Close" : "Open"}
//   - attributi JSX visibili:             title="…" placeholder="…" aria-label="…" label="…"
//   - proprietà visibili negli oggetti:   { label: "…", hint: "…", title: "…" }
//   - argomenti dei messaggi:             toast("…"), alert("…"), confirm("…"), setError("…")
//   - argomenti e proprietà dichiarati in argomenti-testo.json, file per file:  tool("pen", "Pen", "P")
// Anche i template `…${x}…` contano, per le loro parti fisse.
//
// Eccezioni:
//   - le stringhe di non-tradurre.json (sigle, unità, marche), ognuna col suo motivo;
//   - un commento  // testo-ok: <motivo>  sulla riga stessa o su quella prima.
//
// Uso (dalla radice del repository):
//   node ui/src/nova/i18n/filum/check-texts.mjs            solo i file delle aree già tradotte (aree.json)
//   node ui/src/nova/i18n/filum/check-texts.mjs --tutti    tutti i file di Filum
//   node ui/src/nova/i18n/filum/check-texts.mjs <file…>    solo questi file
// Esce con 1 se trova testi scritti a mano.

import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SRC = path.resolve(here, "../../..");
const require = createRequire(path.join(SRC, "..", "package.json"));
const ts = require("typescript");

const json = (f) => JSON.parse(readFileSync(path.join(here, f), "utf8"));

/** Attributi e proprietà che finiscono a schermo. */
const VISIBLE_NAME = /^(title|placeholder|alt|label|hint|tip|tooltip|caption|heading|subtitle|text|desc|description|help|note|message|empty|emptyText|confirmText|okText|cancelText|unit|suffix|prefix|aria-(label|description|roledescription|valuetext|placeholder)|[a-z]+(Label|Title|Hint|Text|Tip|Message))$/;
/** Funzioni il cui primo argomento è un messaggio per l'utente. */
const MESSAGE_FN = /^(toast|alert|confirm|prompt|setError|setStatus|setMessage|setNote|setWarning|notify|ask)$/;
const LETTER = /\p{L}/u;
/** Una stringa che ha l'aria di una frase o di un'etichetta: «Regions», «Sew the swatch» (non «fillToSatin», «btn sm»). */
const LOOKS_LIKE_TEXT = (s) => /^\p{Lu}\p{Ll}/u.test(s.trim()) || /\p{L}{2,}\s+\p{L}{2,}\s+\p{L}{2,}/u.test(s);
/** Attributi JSX tecnici, mai testo. */
const TECHNICAL_ATTR = /^(className|class|id|key|type|href|src|role|name|value|defaultValue|htmlFor|style|target|rel|accept|inputMode|autoComplete|lang|dir|method|d|fill|stroke|viewBox|transform|xmlns|data-[\w-]+|aria-(?!label|description|roledescription|valuetext|placeholder)[\w-]+)$/;

/** Argomenti di funzioni proprie di un file che sono testi visibili: {file: {funzione: [indici]}}. */
export function loadTextArgs() {
  return json("argomenti-testo.json").file;
}

/** Le stringhe che restano uguali in tutte le lingue (sigle, unità, marche). */
export function loadAllowed() {
  return new Set(Object.keys(json("non-tradurre.json").testi));
}

/** Scorciatoie da tastiera («Ctrl+⇧S», «Ctrl+D / Alt+D», «Esc»): tasti, non testo da tradurre («Del» invece sì: in italiano è «Canc»). */
const KEY = /^(?:(?:Ctrl|Alt|Shift|⇧|⌘|⌥)\+?)*(?:[A-Z0-9,.\\/[\]=+-]|F\d+|Esc|Enter|Tab|Space|Home|End|Ctrl|Alt|Shift)$/;
const isKeys = (v) => v.split(/\s*\/\s*/).every((k) => KEY.test(k));
const visibleText = (s, allowed) => {
  const v = s.replace(/\s+/g, " ").trim();
  // le sigle tutte maiuscole (PES, COL, U01) sono uguali in ogni lingua
  return v && LETTER.test(v) && !allowed.has(v) && !isKeys(v) && !/^[A-Z][A-Z0-9]+$/.test(v) ? v : null;
};

/** I testi scritti a mano in un sorgente: [{line, text, why}]. */
export function checkSource(fileName, source, allowed = loadAllowed(), textArgs = loadTextArgs()) {
  const rel = path.relative(SRC, path.resolve(fileName)).split(path.sep).join("/");
  const argsOf = textArgs[rel]?.funzioni ?? {};
  const propsOf = new Set(textArgs[rel]?.["proprietà"] ?? []);
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lines = source.split("\n");
  const exempt = (node) => {
    const l = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
    return /testo-ok:/.test(lines[l] ?? "") || /testo-ok:/.test(lines[l - 1] ?? "");
  };
  const hits = [];
  const report = (node, text, why) => {
    if (exempt(node)) return;
    hits.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text, why, node, sf });
  };

  // le stringhe che un'espressione può dare a schermo (letterali, template, ?:, ||, ??, &&)
  const strings = (e, why) => {
    if (!e) return;
    if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e)) return strings(e.expression, why);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
      const v = visibleText(e.text, allowed);
      if (v) report(e, v, why);
    } else if (ts.isTemplateExpression(e)) {
      const parts = [e.head.text, ...e.templateSpans.map((s) => s.literal.text)].join(" ");
      const v = visibleText(parts, allowed);
      if (v) report(e, v, why);
      for (const s of e.templateSpans) strings(s.expression, why);
    } else if (ts.isConditionalExpression(e)) {
      strings(e.whenTrue, why);
      strings(e.whenFalse, why);
    } else if (ts.isBinaryExpression(e) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.PlusToken].includes(e.operatorToken.kind)) {
      if (e.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) strings(e.left, why);
      strings(e.right, why);
    }
  };

  const nameOf = (n) => (n && (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isPrivateIdentifier(n)) ? n.text : n && ts.isJsxNamespacedName?.(n) ? `${n.namespace.text}:${n.name.text}` : null);

  const visit = (node) => {
    // t("…") e i suoi argomenti non si guardano: sono chiavi e valori
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const fn = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : null;
      if (fn === "t" || fn === "tn") {
        // fuori da ogni funzione t() gira una volta sola, al caricamento, prima che la lingua sia scelta
        let up = node.parent;
        while (up && !ts.isFunctionLike(up)) up = up.parent;
        if (!up && ts.isIdentifier(callee)) report(node, node.getText(sf).slice(0, 80), "t() fuori da una funzione (resterebbe nella lingua del caricamento: usare un getter o withTexts)");
        return;
      }
      if (fn && MESSAGE_FN.test(fn) && node.arguments[0]) strings(node.arguments[0], `messaggio ${fn}()`);
      if (fn && Object.hasOwn(argsOf, fn)) for (const i of argsOf[fn]) strings(node.arguments[i], `argomento ${i + 1} di ${fn}()`);
    }
    if (ts.isJsxText(node)) {
      const v = visibleText(node.text, allowed);
      if (v) report(node, v, "testo JSX");
    } else if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      strings(node.expression, "stringa fra i tag JSX");
    } else if (ts.isJsxAttribute(node)) {
      const name = nameOf(node.name);
      if (name && !VISIBLE_NAME.test(name) && !TECHNICAL_ATTR.test(name) && node.initializer && ts.isStringLiteral(node.initializer) && LOOKS_LIKE_TEXT(node.initializer.text))
        strings(node.initializer, `attributo ${name}`);
      if (name && VISIBLE_NAME.test(name) && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) strings(node.initializer, `attributo ${name}`);
        else if (ts.isJsxExpression(node.initializer)) strings(node.initializer.expression, `attributo ${name}`);
      }
    } else if (ts.isArrayLiteralExpression(node)) {
      // elenchi di etichette: ["axis", "Per shape", "…"], ["Sew the swatch", "Measure it"]
      for (const el of node.elements)
        if ((ts.isStringLiteral(el) || ts.isNoSubstitutionTemplateLiteral(el)) && LOOKS_LIKE_TEXT(el.text)) strings(el, "testo in un elenco");
    } else if (ts.isPropertyAssignment(node)) {
      const name = nameOf(node.name);
      if (name && (VISIBLE_NAME.test(name) || propsOf.has(name))) strings(node.initializer, `proprietà ${name}`);
      // name: "Disc, rows across" — un nome mostrato (oggetti, fili, pezzi); non "sky" o "filum.convert"
      else if (name === "name" && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer)) && LOOKS_LIKE_TEXT(node.initializer.text))
        strings(node.initializer, "proprietà name");
      else if (name === "name" && ts.isTemplateExpression(node.initializer) && LOOKS_LIKE_TEXT(node.initializer.head.text)) strings(node.initializer, "proprietà name");
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

/** I file di Filum: ui/src fuori da nova/, senza test e dichiarazioni. */
export function filumFiles() {
  const walk = (dir) =>
    readdirSync(dir).flatMap((f) => {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) return f === "nova" && dir === SRC ? [] : walk(p);
      return /\.(ts|tsx)$/.test(f) && !/\.(test|d)\.ts$/.test(f) ? [p] : [];
    });
  return walk(SRC).map((p) => path.relative(SRC, p).split(path.sep).join("/")).sort();
}

/** Le aree (aree.json): nome → {fatta, file}. */
export function loadAreas() {
  return json("aree.json").aree;
}

// --- riga di comando ---------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const allowed = loadAllowed();
  let files;
  let label;
  if (args[0] === "--tutti") {
    files = filumFiles().map((f) => path.join(SRC, f));
    label = "tutti i file di Filum";
  } else if (args.length) {
    files = args.map((f) => path.resolve(f));
    label = `${files.length} file`;
  } else {
    const done = Object.entries(loadAreas()).filter(([, a]) => a.fatta);
    files = done.flatMap(([, a]) => a.file).map((f) => path.join(SRC, f));
    label = `aree tradotte: ${done.map(([n]) => n).join(", ") || "nessuna"}`;
  }
  let n = 0;
  for (const f of files) {
    for (const h of checkSource(f, readFileSync(f, "utf8"), allowed)) {
      console.log(`${path.relative(process.cwd(), f)}:${h.line}: ${h.why}: "${h.text}" — usare t("filum.<area>.<chiave>")`);
      n++;
    }
  }
  if (n) {
    console.error(`check-texts: ${n} testi scritti a mano (${label})`);
    process.exit(1);
  }
  console.log(`check-texts: nessun testo scritto a mano (${label})`);
}
