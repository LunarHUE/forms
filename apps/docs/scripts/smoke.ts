/**
 * Smoke test for a deployed docs site. The production deploy runs it against
 * the release candidate and only promotes the build when it passes. Deploys of
 * main run it against `next` and only report.
 *
 *   bun scripts/smoke.ts https://next.forms.lunarhue.dev
 *
 * It checks that each page in PAGES returns 200 with its title, that the
 * search index loads, that no internal link on those pages is broken, and
 * that the pages are kept out of search only if robots.txt disallows the
 * whole site, as the next site does.
 * It uses only fetch and Node built-ins, so CI can run a copy of it from
 * outside the checkout.
 */

import { setTimeout as sleep } from "node:timers/promises";

interface Page {
  readonly path: string;
  readonly title: string;
}

const SITE = "LunarHUE Forms";

/** A few pages per framework, plus one outside the framework tree. */
const PAGES: readonly Page[] = [
  { path: "/react/introduction", title: `Introduction · React · ${SITE}` },
  { path: "/react/install", title: `Install · React · ${SITE}` },
  { path: "/react/plugins/masks", title: `Masks · React · ${SITE}` },
  { path: "/solid/introduction", title: `Introduction · Solid · ${SITE}` },
  { path: "/solid/basics/first-form", title: `Your first form · Solid · ${SITE}` },
  { path: "/solid/integrations/solid-signals", title: `Solid signals · Solid · ${SITE}` },
  { path: "/errors", title: `Errors · ${SITE}` },
];

/**
 * Files that must return 200, checked for status only.
 *
 * TODO(agent routes): once /llms.txt, /agents.txt and the per-page `.md`
 * routes are on main, add them here, e.g. "/llms.txt", "/agents.txt" and
 * "/react/introduction.md".
 */
const FILES: readonly string[] = ["/pagefind/pagefind.js"];

/** Pagefind's manifest. A build that indexed nothing still writes it, so the page count is checked too. */
const SEARCH_ENTRY = "/pagefind/pagefind-entry.json";

/** A fresh deployment can take a few seconds before every edge serves it. */
const READY_TIMEOUT_MS = 60_000;
const LINK_CONCURRENCY = 8;

const base = process.argv[2];
if (base === undefined) {
  console.error("Usage: bun scripts/smoke.ts <base-url>");
  process.exit(2);
}
const siteOrigin = new URL(base).origin;
const failures: string[] = [];

function fail(message: string): void {
  failures.push(message);
  console.log(`  FAIL ${message}`);
}

function pass(message: string): void {
  console.log(`  ok   ${message}`);
}

async function get(path: string): Promise<Response> {
  return fetch(new URL(path, siteOrigin), { headers: { "user-agent": "forms-docs-smoke" } });
}

async function waitUntilReady(): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (true) {
    const status = await get(PAGES[0].path).then(
      (response) => response.status,
      () => 0,
    );
    if (status === 200 || Date.now() > deadline) return;
    await sleep(3_000);
  }
}

function decode(text: string): string {
  // `&amp;` goes last, so `&amp;lt;` decodes to `&lt;`, not to `<`.
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .trim();
}

/** Same-origin paths that <a href> points at, without hash or query. */
function internalLinks(html: string, from: string): string[] {
  const links: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*?\shref="([^"]+)"/g)) {
    const href = decode(match[1]);
    if (href.startsWith("#")) continue;
    // mailto: and other schemes have the origin "null", so this drops them too.
    const url = new URL(href, new URL(from, siteOrigin));
    if (url.origin !== siteOrigin) continue;
    links.push(url.pathname);
  }
  return links;
}

/** Whether robots.txt keeps crawlers off the whole site. */
async function siteHidden(): Promise<boolean> {
  const response = await get("/robots.txt");
  return response.status === 200 && /^Disallow: \/\s*$/m.test(await response.text());
}

async function checkPages(): Promise<Map<string, string>> {
  const hidden = await siteHidden();
  console.log(hidden ? "Pages (robots.txt hides the site)" : "Pages");
  // Each linked path, with the first page that links to it.
  const links = new Map<string, string>();
  for (const page of PAGES) {
    const response = await get(page.path);
    if (response.status !== 200) {
      fail(`${page.path} returned ${response.status}`);
      continue;
    }
    const html = await response.text();
    const title = decode(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "");
    if (title !== page.title) {
      fail(`${page.path} has title "${title}", expected "${page.title}"`);
      continue;
    }
    if (/<meta name="robots" content="noindex"/.test(html) !== hidden) {
      fail(`${page.path} ${hidden ? "lacks" : "has"} robots noindex`);
      continue;
    }
    pass(page.path);
    for (const link of internalLinks(html, page.path)) {
      if (!links.has(link)) links.set(link, page.path);
    }
  }
  return links;
}

/** The page count summed over Pagefind's languages, or 0 when the manifest isn't the expected shape. */
function indexedPages(entry: unknown): number {
  if (typeof entry !== "object" || entry === null || !("languages" in entry)) return 0;
  const { languages } = entry;
  if (typeof languages !== "object" || languages === null) return 0;
  let pages = 0;
  for (const language of Object.values(languages)) {
    if (typeof language !== "object" || language === null || !("page_count" in language)) continue;
    if (typeof language.page_count === "number") pages += language.page_count;
  }
  return pages;
}

async function checkFiles(): Promise<void> {
  console.log("Files");
  for (const path of FILES) {
    const response = await get(path);
    await response.body?.cancel();
    if (response.status === 200) pass(path);
    else fail(`${path} returned ${response.status}`);
  }
  const response = await get(SEARCH_ENTRY);
  if (response.status !== 200) {
    fail(`${SEARCH_ENTRY} returned ${response.status}`);
    return;
  }
  const pages = indexedPages(await response.json());
  if (pages > 0) pass(`${SEARCH_ENTRY} indexes ${pages} pages`);
  else fail(`${SEARCH_ENTRY} indexes no pages`);
}

async function checkLinks(links: Map<string, string>): Promise<void> {
  const checked = new Set(PAGES.map((page) => page.path));
  const queue = [...links].filter(([path]) => !checked.has(path));
  console.log(`Links (${queue.length} more paths)`);
  let broken = 0;
  async function worker(): Promise<void> {
    while (true) {
      const next = queue.shift();
      if (next === undefined) return;
      const [path, from] = next;
      const response = await get(path).catch(() => undefined);
      await response?.body?.cancel();
      if (response === undefined || response.status >= 400) {
        broken += 1;
        fail(`${path} (linked from ${from}) returned ${response?.status ?? "no response"}`);
      }
    }
  }
  await Promise.all(Array.from({ length: LINK_CONCURRENCY }, worker));
  if (broken === 0) pass("no broken links");
}

console.log(`Smoke testing ${siteOrigin}`);
await waitUntilReady();
const links = await checkPages();
await checkFiles();
await checkLinks(links);

if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
