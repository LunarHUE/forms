import { TOP_ID } from "@/components/page/toc-list";
import { DEFAULT_FRAMEWORK, isFramework, type Framework } from "@/lib/frameworks";
import { parsePath } from "@/lib/routes";

/*
 * The browser side of Pagefind. integrations/pagefind.ts writes the index to
 * /pagefind after the build; this loads its script on first use and turns
 * results into what the palette shows. The npm package ships no types for
 * the browser script, so the part used here is declared below.
 */

interface PagefindSubResult {
  title: string;
  url: string;
  excerpt: string;
}

interface PagefindData {
  url: string;
  excerpt: string;
  meta: { title?: string; section?: string };
  sub_results: PagefindSubResult[];
}

interface PagefindSearch {
  results: { id: string; data: () => Promise<PagefindData> }[];
}

interface Pagefind {
  options: (options: { excerptLength?: number }) => Promise<void>;
  init: () => Promise<void>;
  /** Resolves to null when a later call replaced this one. */
  debouncedSearch: (
    query: string,
    options: { filters?: Record<string, string> },
    timeout?: number,
  ) => Promise<PagefindSearch | null>;
}

export interface SearchHit {
  /** Site URL, with a `#heading` for a section. */
  url: string;
  title: string;
  /** Pagefind's excerpt: escaped text with `<mark>` around the matches. */
  excerpt: string;
}

export interface PageHit extends SearchHit {
  /** "Plugins / Masks". */
  path: string;
  /** Matching sections of the page, best first. */
  sections: SearchHit[];
}

const PAGE_LIMIT = 8;
const SECTION_LIMIT = 3;

const isPagefind = (module: unknown): module is Pagefind =>
  typeof module === "object" && module !== null && "init" in module && "debouncedSearch" in module;

let loading: Promise<Pagefind> | undefined;

/** Loads /pagefind/pagefind.js once. A failed load is tried again next time. */
export function loadPagefind(): Promise<Pagefind> {
  loading ??= (async () => {
    // A runtime URL: the file only exists in the built site, so Vite must not resolve it.
    const url = "/pagefind/pagefind.js";
    const pagefind: unknown = await import(/* @vite-ignore */ url);
    if (!isPagefind(pagefind)) throw new Error(`${url} is not Pagefind's search script`);
    await pagefind.options({ excerptLength: 16 });
    await pagefind.init();
    return pagefind;
  })().catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

/** The framework to search: the page's, else the last-used one, else the default. */
export function currentFramework(): Framework {
  const fromPath = parsePath(window.location.pathname)?.framework;
  if (fromPath) return fromPath;
  const fromHtml = document.documentElement.dataset.framework;
  return fromHtml && isFramework(fromHtml) ? fromHtml : DEFAULT_FRAMEWORK;
}

// The site builds with `build.format: "file"`, so Pagefind sees
// /react/install.html. The public URL has no extension.
const siteUrl = (url: string): string => url.replace(/\.html(?=#|$)/, "");

/**
 * Searches one framework's pages. Resolves to null when a newer search
 * started before this one finished.
 */
export async function search(pagefind: Pagefind, query: string, framework: Framework): Promise<PageHit[] | null> {
  const found = await pagefind.debouncedSearch(query, { filters: { framework } }, 120);
  if (!found) return null;
  const pages = await Promise.all(found.results.slice(0, PAGE_LIMIT).map((result) => result.data()));
  return pages.map((page) => {
    const title = page.meta.title ?? siteUrl(page.url);
    return {
      url: siteUrl(page.url),
      title,
      path: page.meta.section ? `${page.meta.section} / ${title}` : title,
      excerpt: page.excerpt,
      sections: page.sub_results
        // Skip the text before the first heading and the H1 (`#top`): the page hit covers them.
        .filter((section) => section.url.includes("#") && !section.url.endsWith(`#${TOP_ID}`))
        .slice(0, SECTION_LIMIT)
        .map((section) => ({ url: siteUrl(section.url), title: section.title, excerpt: section.excerpt })),
    };
  });
}
