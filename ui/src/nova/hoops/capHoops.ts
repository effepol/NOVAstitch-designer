// The cap frames (contract, module a): an explicit list, never guessed from a
// hoop's name. Choosing one of these, or a user hoop of kind "cap", writes
// nova.hoopKind = "cap"; every other hoop writes "flat".

/** Frames of machines.ts, by frame id (on every machine that has them). */
export const CAP_FRAMES: readonly string[] = ["pr-cap", "pr-widecap"];

/** Hoops of lib/hoops.ts, by their full name. */
export const CAP_HOOPS: readonly string[] = ["Cap 130 × 60 mm", "Brother PR Cap frame 13 × 6 cm", "Brother PR Wide cap frame 36 × 6 cm (10-needle)"];
