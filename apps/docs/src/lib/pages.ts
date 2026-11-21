import { getDocs, getErrors, toNavPage } from "./content";
import { compareMarkdownFor } from "./compare-sources";
import { demoSources } from "./demo-sources";
import { AVAILABLE_FRAMEWORKS, type Framework } from "./frameworks";
import { lastCommitDate } from "./git";
import { toMarkdown } from "./markdown";
import { sidebar } from "./nav";
import { ERRORS_HREF } from "./routes";
import { deployUrl } from "./site";

/** A page of the latest docs, as the sitemap and the files for language models see it. */
export interface SitePage {
  /** Undefined for the errors page, which every framework shares. */
  readonly framework?: Framework;
  /** The entry id, or `errors`. */
  readonly slug: string;
  /** The page's path, as in `/react/plugins/masks`. */
  readonly href: string;
  readonly title: string;
  readonly description: string;
  /** From git. Undefined without history. */
  readonly lastUpdated?: Date;
  /** The page as Markdown for its framework. */
  markdown(): string;
}

/** Where a page's Markdown copy lives. */
export const markdownHref = (href: string): string => `${href}.md`;

/**
 * Every page of the latest version: each framework's pages in sidebar order,
 * then the errors page once.
 */
export async function sitePages(): Promise<SitePage[]> {
  const entries = await getDocs();
  const pages = entries.map(toNavPage);
  const docs = AVAILABLE_FRAMEWORKS.flatMap((framework) =>
    sidebar(pages, framework)
      .flatMap((group) => group.items)
      .flatMap((item): SitePage[] => {
        const entry = entries.find((candidate) => candidate.id === item.slug);
        if (!entry) return [];
        const { title, description } = entry.data;
        return [
          {
            framework,
            slug: entry.id,
            href: item.href,
            title,
            description,
            lastUpdated: entry.filePath ? lastCommitDate(entry.filePath) : undefined,
            markdown: () =>
              toMarkdown({
                title,
                description,
                body: entry.body ?? "",
                framework,
                url: deployUrl(item.href),
                demo: (name) => demoSources(framework, name),
                compare: compareMarkdownFor,
              }),
          },
        ];
      }),
  );

  const errors = await getErrors();
  const { title, description } = errors.data;
  return [
    ...docs,
    {
      slug: "errors",
      href: ERRORS_HREF,
      title,
      description,
      lastUpdated: errors.filePath ? lastCommitDate(errors.filePath) : undefined,
      markdown: () => toMarkdown({ title, description, body: errors.body ?? "", url: deployUrl(ERRORS_HREF) }),
    },
  ];
}
