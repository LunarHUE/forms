/** The import every demo's `createForms` file has for the docs' devtools (src/devtools/enabled.ts). */
const importLine = 'import { docsDevtools } from "@/devtools/enabled";\n';

/**
 * Removes the docs' devtools wiring from a demo's source, so the file tabs
 * shows the plain example: the import line and `docsDevtools` in a
 * `plugins` list. Throws when `docsDevtools` is still there after, so a
 * demo written another way fails the build instead of leaking the wiring.
 */
export function hideDevtools(code: string): string {
  const out = code
    .replace(importLine, "")
    .replace("createForms({ plugins: [docsDevtools] })", "createForms()")
    .replace("plugins: [docsDevtools], ", "")
    .replace(", docsDevtools]", "]");
  if (out.includes("docsDevtools")) {
    throw new Error(
      `A demo installs docsDevtools in a way the code view can't hide. Add it last in createForms' plugins:\n${code}`,
    );
  }
  return out;
}
