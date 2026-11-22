import { frameworkLabel, AVAILABLE_FRAMEWORKS, type Framework } from "./frameworks";
import { markdownHref, type SitePage } from "./pages";
import { deployUrl, SITE_DESCRIPTION, SITE_NAME } from "./site";

export const LLMS_HREF = "/llms.txt";
export const LLMS_FULL_HREF = "/llms-full.txt";
/** The full text for one framework, like `/react/llms-full.txt`. */
export const llmsFullHref = (framework: Framework): string => `/${framework}${LLMS_FULL_HREF}`;

const item = (page: SitePage) =>
  `- [${page.title}](${deployUrl(markdownHref(page.href))}): ${page.description}`;

/** Points models at the Best practices section before they write a form. */
const BEST_PRACTICES = [
  "Before structuring a form, read the Best practices pages (the `best-practices/` pages for your framework) and follow",
  "them. They cover choosing `/mini` or the full entry, keeping the shared `createForms` small, where plugins go, defining",
  "forms at module scope, server errors with `setErrors`, live updates with `rebase()`, external stores, refs under React",
  "Compiler, and parts that must be active during SSR.",
].join("\n");

/**
 * The index for language models, following https://llmstxt.org: a title, a
 * summary, then a list per framework linking each page's Markdown copy.
 */
export function llmsIndex(pages: readonly SitePage[]): string {
  const sections = AVAILABLE_FRAMEWORKS.map((framework) => {
    const own = pages.filter((page) => page.framework === framework);
    return `## ${frameworkLabel(framework)}\n\n${own.map(item).join("\n")}`;
  });
  const shared = pages.filter((page) => page.framework === undefined);
  const fullTexts = [
    `- [All pages](${deployUrl(LLMS_FULL_HREF)}): every page below in one file`,
    ...AVAILABLE_FRAMEWORKS.map(
      (framework) =>
        `- [${frameworkLabel(framework)} pages](${deployUrl(llmsFullHref(framework))}): the ${frameworkLabel(framework)} pages and the error codes in one file`,
    ),
  ];
  return [
    `# ${SITE_NAME}`,
    `> ${SITE_DESCRIPTION}`,
    [
      "Every docs page exists once per framework adapter. The pages share their prose and differ in code: pick the",
      "list for the framework you use. Each link is the page's Markdown copy; the HTML page is the same URL",
      "without `.md`. Demos appear as their source files.",
    ].join("\n"),
    BEST_PRACTICES,
    ...sections,
    `## Shared\n\n${shared.map(item).join("\n")}`,
    `## Full text\n\n${fullTexts.join("\n")}`,
  ].join("\n\n") + "\n";
}

/** Every page's Markdown in one file, `framework`'s pages only when it is given. */
export function llmsFull(pages: readonly SitePage[], framework?: Framework): string {
  const chosen = framework ? pages.filter((page) => page.framework === undefined || page.framework === framework) : pages;
  const scope = framework ? `${frameworkLabel(framework)} docs` : "docs for every framework";
  const header = `# ${SITE_NAME}\n\n> ${SITE_DESCRIPTION}\n\nThe ${scope}, one page after another. Index: ${deployUrl(LLMS_HREF)}\n\n${BEST_PRACTICES}\n`;
  return [header, ...chosen.map((page) => page.markdown())].join("\n---\n\n");
}
