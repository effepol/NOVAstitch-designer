// Module start (module 0): every module that needs to start (register its
// commands, listeners, menu items, project format…) has ui/src/nova/<module>/install.ts
// exporting install(). main.tsx calls startModules once; no Filum file lists the modules.

type Installer = { install?: () => void | Promise<void> };

/** Start every module; one that fails is reported and the others still start. */
export async function startModules(): Promise<void> {
  const found = import.meta.glob<Installer>("../*/install.ts", { eager: true });
  for (const [file, mod] of Object.entries(found).sort(([a], [b]) => a.localeCompare(b))) {
    try {
      await mod.install?.();
    } catch (e) {
      console.error(`nova: ${file} failed to start`, e);
    }
  }
}
