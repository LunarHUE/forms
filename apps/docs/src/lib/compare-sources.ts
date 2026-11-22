import { libraries } from "../../../../examples/compare/apps";
import sizesFile from "../../../../examples/compare/sizes.json";

import {
  COMPARE_LIBRARIES,
  compareMarkdown,
  LIBRARY_PACKAGES,
  type AppSizes,
  type CompareBuild,
  type SizesFile,
} from "./compare";

/** Measured by scripts/size-compare.ts. Never typed in by hand. */
export const SIZES: SizesFile = sizesFile;

// Each library's own files. main.tsx and index.html only mount the app and
// are the same on both sides, so they stay out.
const sources = import.meta.glob<string>(
  ["../../../../examples/compare/*/*/*.{ts,tsx}", "!../../../../examples/compare/*/*/main.tsx"],
  { query: "?raw", import: "default", eager: true },
);

const PREFIX = "../../../../examples/compare/";
const ENTRY = "App.tsx";

/** The apps sizes.json measured, like `signup`. */
export const COMPARE_APPS: readonly string[] = Object.keys(SIZES.apps);

export function isCompareApp(app: string): boolean {
  return COMPARE_APPS.includes(app);
}

/** One app's numbers. Throws for an app sizes.json doesn't have. */
export function appSizes(app: string): AppSizes {
  const sizes = SIZES.apps[app];
  if (sizes === undefined) throw new Error(`examples/compare/sizes.json has no app "${app}".`);
  return sizes;
}

/** Both builds of an app, ours first, each with its files App.tsx first. */
export function compareBuilds(app: string): CompareBuild[] {
  appSizes(app);
  return COMPARE_LIBRARIES.map((library) => {
    const folder = `${PREFIX}${app}/${library}/`;
    const files = Object.entries(sources)
      .filter(([path]) => path.startsWith(folder))
      .map(([path, code]) => ({ name: path.slice(folder.length), code: code.replace(/\n$/, "") }))
      .toSorted((a, b) => (a.name === ENTRY ? -1 : b.name === ENTRY ? 1 : a.name.localeCompare(b.name)));
    if (files.length === 0) throw new Error(`examples/compare/${app}/${library} has no files.`);
    const title = libraries.find((candidate) => candidate.name === library)?.title ?? library;
    const version = SIZES.versions[LIBRARY_PACKAGES[library]];
    if (version === undefined) throw new Error(`examples/compare/sizes.json has no version for ${LIBRARY_PACKAGES[library]}.`);
    return { library, title, version, files };
  });
}

/** `<Compare app>` as Markdown. */
export function compareMarkdownFor(app: string): string {
  return compareMarkdown(compareBuilds(app), appSizes(app));
}
