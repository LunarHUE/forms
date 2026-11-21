/*
 * Pageview tracking. Layout.astro calls `startAnalytics()`, which reports each
 * page the visitor lands on or navigates to with the client router (the
 * `astro:page-load` event). Hover prefetches load no page, so they aren't
 * counted. Each pageview is one POST to /_/t (functions/_/t.ts):
 *
 *   { path, framework, referrer, status, device }
 *
 * It only reports on the two public sites (ANALYTICS_HOSTS), so local builds,
 * the e2e tests and previews send nothing. It skips `/`, which only
 * redirects, and a page reported just before. The referrer goes with the
 * first pageview only: after a client-side navigation `document.referrer`
 * still names the page the visit came from. No cookies or storage are used,
 * and a failed send stays silent.
 */
import {
  ANALYTICS_HOSTS,
  asFramework,
  frameworkFromPath,
  normalizePath,
  type DeviceClass,
  type Pageview,
} from "../../functions/_analytics";

const ENDPOINT = "/_/t";

let started = false;
let lastPath: string | undefined;
let firstPageview = true;

function referrerOrigin(): string {
  try {
    return document.referrer ? new URL(document.referrer).origin : "";
  } catch {
    return "";
  }
}

interface UserAgentData {
  readonly mobile: boolean;
}

function device(): DeviceClass {
  const data = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  if (data !== undefined) return data.mobile ? "mobile" : "desktop";
  return /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

function send(body: string): void {
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
  } catch {
    // Fall through to fetch.
  }
  try {
    fetch(ENDPOINT, {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Nothing else to try.
  }
}

/** Reports the current page, unless it isn't counted. */
export function trackPageview(): void {
  if (!Object.hasOwn(ANALYTICS_HOSTS, location.hostname)) return;
  const path = normalizePath(location.pathname);
  if (path === undefined || path === "/" || path === lastPath) return;
  lastPath = path;

  const root = document.documentElement;
  const pageview: Pageview = {
    path,
    framework: asFramework(root.dataset["framework"]) ?? frameworkFromPath(path),
    referrer: firstPageview ? referrerOrigin() : "",
    status: root.dataset["status"] === "404" ? 404 : 200,
    device: device(),
  };
  firstPageview = false;
  send(JSON.stringify(pageview));
}

/** Starts reporting pageviews. Call once; later calls do nothing. */
export function startAnalytics(): void {
  if (started) return;
  started = true;
  document.addEventListener("astro:page-load", trackPageview);
}

export function resetAnalyticsForTests(): void {
  if (started) document.removeEventListener("astro:page-load", trackPageview);
  started = false;
  lastPath = undefined;
  firstPageview = true;
}
