# Varietà incluse (modulo n)

Un file JSON per varietà: `id`, `name` (`it`, `en`), `type` (`tatami` o `satin`), `values`.

- tatami: `lengthPattern` (lunghezze in mm, usate a turno lungo la riga), `offsetPattern` (spostamento della riga k, quota della sequenza, 0..1)
- satin: `splitLengthPattern`, `splitOffsetPattern` (gli stessi, per i punti spezzati)

Le varietà dell'utente vanno nella cartella `varieta/` dei dati del programma (solo desktop), con lo stesso formato. Un file non valido è saltato.
Valori provvisori, da verificare al primo ricamo (vedi `varieties.ts`).
