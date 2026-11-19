// Module g: the anchors a lesson may highlight. Every module lists its own in
// ui/src/nova/<module>/anchors.json (anchor → what it is); a lesson naming any
// other anchor is refused (g.6). Filum's own elements have none yet: module 0
// adds them.

/** Every anchors.json of the modules (Vite finds them when it builds; none in the Node tests). */
function discover(): Record<string, Record<string, string>> {
  try {
    return import.meta.glob<Record<string, string>>("../*/anchors.json", { eager: true, import: "default" });
  } catch {
    return {};
  }
}

/** The declared anchors: the keys of every anchors.json. */
export function declaredAnchors(found: Record<string, Record<string, string>> = discover()): Set<string> {
  const out = new Set<string>();
  for (const list of Object.values(found)) for (const k of Object.keys(list ?? {})) out.add(k);
  return out;
}
