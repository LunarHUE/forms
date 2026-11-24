import { describe, expect, it, vi } from "vitest";

import { llmsFull, llmsIndex } from "./llms";
import type { SitePage } from "./pages";

// `pages.ts` reads the content collection, which only exists inside Astro.
vi.mock("./pages", () => ({ markdownHref: (href: string) => `${href}.md` }));

const page = (slug: string, title: string): SitePage => ({
  framework: "react",
  slug,
  href: `/react/${slug}`,
  title,
  description: `${title} page.`,
  markdown: () => `# ${title}\n`,
});

const pages = [page("introduction", "Introduction"), page("best-practices/bundling-and-splitting", "Bundling, plugins, and /mini")];

describe("llms files", () => {
  it("tells models to follow the Best practices pages before the page lists", () => {
    const index = llmsIndex(pages);
    const advice = index.indexOf("read the Best practices pages");
    expect(advice).toBeGreaterThan(-1);
    expect(advice).toBeLessThan(index.indexOf("## React"));
    expect(index).toContain("/react/best-practices/bundling-and-splitting.md");
  });

  it("repeats the advice in the full text header", () => {
    const [header] = llmsFull(pages, "react").split("\n---\n\n");
    expect(header).toContain("read the Best practices pages");
  });
});
