import type { Framework } from "./frameworks";

export const SITE_NAME = "LunarHUE Forms";

/**
 * Which deploy a build is for. `release` is production, which serves the
 * latest release (and later older versions too), and also covers local
 * builds and pull request previews. `next` serves main's docs only.
 * docs-deploy.yml sets DOCS_CHANNEL=next for main, and astro.config.ts passes
 * it through, since Vite exposes no unprefixed variable on its own.
 */
export type Channel = "release" | "next";

export const CHANNEL: Channel = import.meta.env.DOCS_CHANNEL === "next" ? "next" : "release";

/** Where each channel is served. */
export const CHANNEL_URLS: Readonly<Record<Channel, string>> = {
  release: "https://forms.lunarhue.dev",
  next: "https://next.forms.lunarhue.dev",
};

/** This build's origin, also `site` in astro.config.ts. */
export const SITE_URL = CHANNEL_URLS[CHANNEL];

export const GITHUB_URL = "https://github.com/LunarHUE/forms";

export const SITE_DESCRIPTION = "Type-safe forms for React and Solid, with features as plugins.";

/** The adapter package a framework installs. */
export const adapterPackage = (framework: Framework): string => `@lunarhue/forms-${framework}`;

export const npmUrl = (pkg: string): string => `https://www.npmjs.com/package/${pkg}`;

/** An absolute URL on the channel's site, for canonical links, Open Graph and the sitemap. */
export const absoluteUrl = (path: string): string => new URL(path, SITE_URL).href;

/**
 * Where this build is served: a pull request preview's branch alias, or the
 * channel's site. docs-deploy.yml sets DOCS_URL for previews.
 */
export const DEPLOY_URL: string = import.meta.env.DOCS_URL || SITE_URL;

/**
 * An absolute URL on the deployment serving this build. The Markdown copies
 * and llms files link with these, so a copy taken from a preview points back
 * at that preview, even once pasted somewhere else.
 */
export const deployUrl = (path: string): string => new URL(path, DEPLOY_URL).href;

/**
 * The Cloudflare Web Analytics site token, or "" to leave the beacon out.
 * docs-production.yml and docs-deploy.yml set CF_WEB_ANALYTICS_TOKEN for
 * production and next only, so local builds, the e2e tests and previews load
 * no beacon.
 */
export const CF_WEB_ANALYTICS_TOKEN: string = import.meta.env.CF_WEB_ANALYTICS_TOKEN ?? "";
