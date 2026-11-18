// Tipi di regola-i3.mjs per i test in TypeScript.
export declare const norm: (s: string) => string;
export declare const pattern: (text: string) => RegExp;
export declare function markedWithFilum(
  ref: Record<string, string[]>,
  marked: Record<string, [string, string][]>,
  catalogs: [string, string][],
  app?: (l: string[]) => string[],
): Record<string, string[]>;
