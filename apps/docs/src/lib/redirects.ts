import { AVAILABLE_FRAMEWORKS } from "./frameworks";

/**
 * Pages that moved, from the old slug to the new one. Every framework gets a
 * redirect page at the old URL, so links from READMEs and search results keep
 * working. Point each old slug at where its content lives now, not at a slug
 * that redirects again.
 */
export const MOVED: Readonly<Record<string, string>> = {
  "first-form": "basics/first-form",
  "concepts/fields": "basics/fields",
  "concepts/validation": "basics/validation",
  "concepts/submit": "basics/submit",
  "concepts/display-text": "basics/fields",
  "basics/display-text": "basics/fields",
  "concepts/typed-paths": "composition/typed-paths",
  "concepts/arrays": "plugins/arrays",
  "plugins/writing-a-plugin": "writing-plugins/first-plugin",
};

/**
 * Astro's `redirects` config for the moved pages, latest version only. Older
 * versions are built from their own content, with their own slugs.
 */
export function docRedirects(moved: Readonly<Record<string, string>> = MOVED): Record<string, string> {
  return Object.fromEntries(
    AVAILABLE_FRAMEWORKS.flatMap((framework) =>
      Object.entries(moved).map(([from, to]) => [`/${framework}/${from}`, `/${framework}/${to}`]),
    ),
  );
}
