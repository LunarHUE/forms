/*
 * What the Pages Functions record in Workers Analytics Engine, and the
 * helpers that build it. `_/t.ts` records pageviews the browser reports;
 * `_middleware.ts` records fetches of the Markdown and llms files. The
 * pageview tracker (src/lib/analytics.ts) shares the host list.
 *
 * Every data point has the same shape, so one SQL query reads both events
 * (scripts/analytics.ts):
 *
 *   index1   channel        "release" | "next"
 *   blob1    event          "pageview" | "agent_fetch"
 *   blob2    path           normalized pathname, no query or hash
 *   blob3    framework      "react" | "solid" | ""
 *   blob4    referrer_host  external referrer's hostname, or ""
 *   blob5    country        two-letter code from Cloudflare, or ""
 *   blob6    client         pageview: "mobile" | "desktop" | ""
 *                           agent_fetch: client family (agentClient)
 *   blob7    host           the site's hostname
 *   double1  status         200 or 404 for pageviews, the response's status for agent fetches
 *
 * No cookies, no IP addresses and no raw user agents are stored. Only the two
 * public sites record anything: local builds, previews, the release candidate
 * and the smoke test (scripts/smoke.ts) are left out.
 *
 * Wrangler bundles this folder on its own, so imports here are relative and
 * nothing may read `import.meta.env` (src/lib/site.ts does). The Cloudflare
 * types are written out below instead of coming from @cloudflare/workers-types,
 * whose globals clash with the DOM and Node types `astro check` loads.
 */
import { AVAILABLE_FRAMEWORKS, type Framework } from "../src/lib/frameworks";
import type { Channel } from "../src/lib/site";

export interface AnalyticsEngineDataPoint {
  indexes?: string[];
  blobs?: string[];
  doubles?: number[];
}

export interface AnalyticsEngineDataset {
  writeDataPoint(point?: AnalyticsEngineDataPoint): void;
}

export interface PagesEnv {
  /** Bound by wrangler.jsonc. Missing in `wrangler pages dev` without the binding. */
  DOCS_ANALYTICS?: AnalyticsEngineDataset;
}

/** The part of `request.cf` read here. */
export interface IncomingCf {
  country?: string;
}

export type PagesRequest = Request & { cf?: IncomingCf };

export interface PagesContext {
  request: PagesRequest;
  env: PagesEnv;
  next(): Promise<Response>;
}

/** The public sites, with the channel each serves (CHANNEL_URLS in src/lib/site.ts). */
export const ANALYTICS_HOSTS: Readonly<Record<string, Channel>> = {
  "forms.lunarhue.dev": "release",
  "next.forms.lunarhue.dev": "next",
};

/** The user agent scripts/smoke.ts sends. */
export const SMOKE_USER_AGENT = "forms-docs-smoke";

const MAX_PATH = 256;
const MAX_REFERRER_HOST = 128;

export type AnalyticsEvent = "pageview" | "agent_fetch";
export type DeviceClass = "mobile" | "desktop" | "";
export type PageStatus = 200 | 404;

export interface AnalyticsPoint {
  readonly channel: Channel;
  readonly event: AnalyticsEvent;
  readonly path: string;
  readonly framework: Framework | "";
  readonly referrerHost: string;
  readonly country: string;
  readonly client: string;
  readonly host: string;
  readonly status: number;
}

/** The channel a public site serves, or undefined for any other host. */
export function channelFor(host: string): Channel | undefined {
  const name = host.toLowerCase();
  return Object.hasOwn(ANALYTICS_HOSTS, name) ? ANALYTICS_HOSTS[name] : undefined;
}

export function isSmokeTest(userAgent: string | null): boolean {
  return userAgent?.includes(SMOKE_USER_AGENT) ?? false;
}

/** The channel to record a request under, or undefined when it isn't recorded. */
export function recordingChannel(request: Request): Channel | undefined {
  if (isSmokeTest(request.headers.get("user-agent"))) return undefined;
  return channelFor(new URL(request.url).hostname);
}

/**
 * A pathname as the site links to it: no query or hash, no `.html` (the build
 * writes `react/install.html`), no trailing slash. Undefined for anything
 * that isn't a path.
 */
export function normalizePath(path: string): string | undefined {
  const bare = path.split(/[?#]/, 1)[0] ?? "";
  if (!bare.startsWith("/")) return undefined;
  const clean = bare.replace(/(\/index)?\.html$/, "").replace(/\/+$/, "") || "/";
  return clean.slice(0, MAX_PATH);
}

const AGENT_FILES = new Set(["/llms.txt", "/llms-full.txt", "/agents.txt", "/errors.md"]);

/** The Markdown copies and llms files, which agents fetch instead of the pages. */
export function isAgentPath(pathname: string): boolean {
  return AGENT_FILES.has(pathname) || pathname.endsWith(".md") || pathname.endsWith("/llms-full.txt");
}

export function asFramework(value: unknown): Framework | undefined {
  return AVAILABLE_FRAMEWORKS.find((id) => id === value);
}

/** The framework a path belongs to, from its first segment. */
export function frameworkFromPath(path: string): Framework | "" {
  return asFramework(path.split("/")[1]) ?? "";
}

/**
 * The referrer's hostname, lowercased. Empty when there is none, it doesn't
 * parse, it isn't http(s), or it is the site itself.
 */
export function referrerHost(referrer: string | null | undefined, ownHost: string): string {
  if (!referrer) return "";
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "";
  const host = url.hostname.toLowerCase();
  return host === ownHost.toLowerCase() ? "" : host.slice(0, MAX_REFERRER_HOST);
}

/** Cloudflare's two-letter country code, or "" (Tor is "T1", unknown is "XX"). */
export function countryOf(request: PagesRequest): string {
  const country = request.cf?.country?.toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(country) && country !== "XX" ? country : "";
}

/** Client families, checked in order against the lowercased user agent. */
const AGENT_FAMILIES: readonly (readonly [family: string, pattern: RegExp])[] = [
  ["claude", /claude/],
  ["anthropic", /anthropic/],
  ["openai", /openai|chatgpt|gptbot|oai-searchbot/],
  ["cursor", /cursor/],
  ["perplexity", /perplexity/],
  ["google", /google/],
  ["curl", /^curl\//],
];

/**
 * A coarse name for what fetched an agent file. Only browsers send
 * Sec-Fetch-Site, so `same-origin` is the docs' own copy button.
 */
export function agentClient(userAgent: string | null, secFetchSite: string | null): string {
  if (secFetchSite === "same-origin") return "browser-copy";
  const ua = userAgent?.toLowerCase() ?? "";
  for (const [family, pattern] of AGENT_FAMILIES) {
    if (pattern.test(ua)) return family;
  }
  return ua.startsWith("mozilla/") ? "browser" : "other";
}

export interface Pageview {
  readonly path: string;
  readonly framework: Framework | "";
  readonly referrer: string;
  readonly status: PageStatus;
  readonly device: DeviceClass;
}

const DEVICES: readonly DeviceClass[] = ["mobile", "desktop", ""];

/** The pageview a tracker posted, or undefined if the body isn't one. */
export function parsePageview(body: unknown): Pageview | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const field = (key: string, fallback?: unknown): unknown =>
    Object.hasOwn(body, key) ? Object.getOwnPropertyDescriptor(body, key)?.value : fallback;
  const path = field("path");
  const framework = field("framework");
  const referrer = field("referrer", "");
  const status = field("status", 200);
  const device = field("device", "");
  const clean = typeof path === "string" ? normalizePath(path) : undefined;
  if (clean === undefined) return undefined;
  if (framework !== undefined && framework !== "" && asFramework(framework) === undefined) return undefined;
  if (typeof referrer !== "string") return undefined;
  if (status !== 200 && status !== 404) return undefined;
  const deviceClass = DEVICES.find((known) => known === device);
  if (deviceClass === undefined) return undefined;
  return {
    path: clean,
    framework: asFramework(framework) ?? frameworkFromPath(clean),
    referrer,
    status,
    device: deviceClass,
  };
}

/**
 * Writes one data point. Returns whether it was written: false without the
 * binding, or if the write throws, which never reaches the visitor.
 */
export function writeAnalyticsPoint(env: PagesEnv, point: AnalyticsPoint): boolean {
  const dataset = env.DOCS_ANALYTICS;
  if (dataset === undefined) return false;
  try {
    dataset.writeDataPoint({
      indexes: [point.channel],
      blobs: [
        point.event,
        point.path,
        point.framework,
        point.referrerHost,
        point.country,
        point.client,
        point.host,
      ],
      doubles: [point.status],
    });
    return true;
  } catch {
    return false;
  }
}
