import type { Framework } from "./frameworks";

export const SITE_NAME = "LunarHUE Forms";

/** Production origin, also `site` in astro.config.ts. */
export const SITE_URL = "https://forms.lunarhue.dev";

export const GITHUB_URL = "https://github.com/LunarHUE/forms";

export const SITE_DESCRIPTION = "Type-safe forms for React and Solid, with features as plugins.";

/** The adapter package a framework installs. */
export const adapterPackage = (framework: Framework): string => `@lunarhue/forms-${framework}`;

export const npmUrl = (pkg: string): string => `https://www.npmjs.com/package/${pkg}`;

/** An absolute URL on the production site. */
export const absoluteUrl = (path: string): string => new URL(path, SITE_URL).href;
