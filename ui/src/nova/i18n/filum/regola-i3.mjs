// Modulo i — regola i.3 del 13/11 per l'interfaccia dei moduli: un elemento marcato data-nova
// (lo mette il modulo 0 su ciò che Filum disegna dal registro) non può contenere una scritta di
// Filum 0.2.1. Non conta una scritta che è anche nel catalogo del modulo che ha marcato
// l'elemento («Close», «About»). Usata dal giro (giro.mjs); provata da regola-i3.test.ts.

/** Cifre → # (come nel riferimento). */
export const norm = (s) => s.replace(/\d+(?:[.,  ]\d+)*/g, "#");

/** Una voce di catalogo come confronto: cifre → #, un segnaposto {nome} vale qualunque testo. */
export const pattern = (text) => new RegExp("^" + norm(text).split(/\{\w+\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".+") + "$");

/**
 * Le scritte di Filum dentro elementi marcati, schermata per schermata: {schermata: ["scritta (modulo)"]}.
 * ref: le scritte di Filum 0.2.1 per schermata; marked: [scritta, modulo] per schermata;
 * catalogs: [modulo, testo inglese] di ogni catalogo dei moduli; app: come il giro scrive il nome del programma.
 */
export function markedWithFilum(ref, marked, catalogs, app = (l) => l) {
  const ownedBy = (text, mod) => catalogs.some(([m, v]) => m === mod && pattern(v).test(text));
  const hidden = {};
  for (const id of Object.keys(ref)) {
    const filum = new Set(ref[id]);
    const inside = (marked[id] ?? []).filter(([s, mod]) => filum.has(app([s])[0]) && !ownedBy(s, mod)).map(([s, mod]) => `${s} (${mod})`);
    if (inside.length) hidden[id] = inside;
  }
  return hidden;
}
