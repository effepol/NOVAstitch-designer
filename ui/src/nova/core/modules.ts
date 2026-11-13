// Module start (module 0): every module that needs to start (register its
// commands, listeners, menu items, project format…) has ui/src/nova/<module>/install.ts
// exporting install(). installBridge starts them once at start (main.tsx already
// calls it); no Filum file lists the modules, and main.tsx is not touched.

type Installer = { install?: () => void | Promise<void> };

/** Every nova/<module>/install.ts (Vite finds them when it builds; none in the Node tests). */
function discover(): Record<string, Installer> {
  try {
    return import.meta.glob<Installer>("../*/install.ts", { eager: true });
  } catch {
    return {};
  }
}

let started: Promise<void> | null = null;

/** Start every module once, in name order; one that fails is reported and the others still start. */
export function startModules(found: Record<string, Installer> = discover()): Promise<void> {
  return (started ??= (async () => {
    for (const [file, mod] of Object.entries(found).sort(([a], [b]) => a.localeCompare(b))) {
      try {
        await mod.install?.();
      } catch (e) {
        console.error(`nova: ${file} failed to start`, e);
      }
    }
  })());
}

/** Resolves once the modules have started (at once if they were never started). */
export const modulesReady = (): Promise<void> => started ?? Promise.resolve();
