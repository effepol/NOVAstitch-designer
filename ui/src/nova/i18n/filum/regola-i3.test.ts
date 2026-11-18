// Modulo i — regola i.3 del 13/11, la parte che il giro non mette mai alla prova da solo:
// un elemento marcato data-nova (interfaccia di un modulo) che contiene una scritta di Filum
// 0.2.1 fa fallire i.3. Non conta una scritta che è anche nel catalogo del modulo che ha
// marcato l'elemento («Close», «About»). La funzione è quella che usa il giro (giro.mjs).

import { check, done } from "../../core/testkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { markedWithFilum } from "./regola-i3.mjs";

// un riferimento piccolo: due schermate di Filum con le loro scritte
const ref = { avvio: ["Layers", "Issues", "Close"], "pannello/disegno": ["Hoop", "Fabric"] };
const catalogs: [string, string][] = [["a", "Hoops"], ["a", "Close"], ["b", "Sequence"], ["a", "{n} hoops"]];

// le scritte dei moduli, marcate, che non sono di Filum: i.3 passa
check(Object.keys(markedWithFilum(ref, { avvio: [["Hoops", "a"], ["Sequence", "b"], ["3 hoops", "a"]] }, catalogs)).length === 0, "i.3: marked texts of the modules that are not Filum's pass");

// una scritta di Filum dentro un elemento marcato: i.3 fallisce, con la schermata e il modulo
const bad = markedWithFilum(ref, { avvio: [["Layers", "b"], ["Hoops", "a"]], "pannello/disegno": [["Fabric", "a"]] }, catalogs);
check(JSON.stringify(bad) === JSON.stringify({ avvio: ["Layers (b)"], "pannello/disegno": ["Fabric (a)"] }), `i.3: a Filum text inside a marked element fails, naming screen and module (${JSON.stringify(bad)})`);

// la stessa parola di Filum, ma nel catalogo del modulo che ha marcato l'elemento: non conta
check(Object.keys(markedWithFilum(ref, { avvio: [["Close", "a"]] }, catalogs)).length === 0, "i.3: a word that is also in the marking module's own catalogue does not count («Close»)");
// …ma nel catalogo di un altro modulo sì
check(JSON.stringify(markedWithFilum(ref, { avvio: [["Close", "b"]] }, catalogs)) === JSON.stringify({ avvio: ["Close (b)"] }), "i.3: …in another module's catalogue it does");

// il nome del programma conta come quello di Filum (‹app›), come nel resto del giro
const app = (l: string[]) => l.map((s) => s.replaceAll("NOVAstitch Designer", "‹app›").replaceAll("Filum", "‹app›"));
const refApp = { avvio: app(["About Filum"]) };
check(Object.keys(markedWithFilum(refApp, { avvio: [["About NOVAstitch Designer", "x"]] }, catalogs, app)).length === 1, "i.3: the program's name is compared as ‹app›");

// il giro usa proprio questa funzione
const giro = readFileSync(path.join(process.cwd(), "src", "nova", "i18n", "filum", "giro.mjs"), "utf8");
check(/from "\.\/regola-i3\.mjs"/.test(giro) && /markedWithFilum\(/.test(giro), "giro.mjs uses markedWithFilum for i.3");

done("rule i.3, marked elements");
