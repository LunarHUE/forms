import type { Framework } from "./frameworks";
import { frameworkLabel } from "./frameworks";
import { frameworkHref } from "./routes";
import { absoluteUrl, adapterPackage, GITHUB_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "./site";

/** What a page adds to its <head> beyond title and description. Layout takes it as `meta`. */
export interface PageMeta {
  /** The canonical path. Defaults to the page's own. */
  readonly canonical?: string;
  /** Path of the page's Markdown copy, for <link rel="alternate">. */
  readonly markdown?: string;
  /** `og:type`. Defaults to `website`. */
  readonly type?: "website" | "article";
  /** When the page last changed, for `article:modified_time`. */
  readonly modified?: Date;
  /** JSON-LD objects, each written to its own script tag. */
  readonly structuredData?: readonly object[];
}

const publisher = { "@type": "Organization", name: "LunarHUE", url: "https://github.com/LunarHUE" };

/** The site as schema.org WebSite, for the home page. */
export const websiteData = (): object => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  publisher,
});

interface DocData {
  title: string;
  description: string;
  /** The page's path. */
  href: string;
  framework?: Framework;
  /** The sidebar section, as in "Plugins". */
  section: string;
  modified?: Date;
}

/**
 * A docs page as schema.org TechArticle, plus a BreadcrumbList from the
 * framework's docs to the page.
 */
export function docData({ title, description, href, framework, section, modified }: DocData): object[] {
  const url = absoluteUrl(href);
  const article = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: title,
    description,
    url,
    inLanguage: "en",
    articleSection: section,
    ...(modified ? { dateModified: modified.toISOString() } : {}),
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    publisher,
    ...(framework
      ? {
          about: {
            "@type": "SoftwareSourceCode",
            name: adapterPackage(framework),
            codeRepository: GITHUB_URL,
            programmingLanguage: "TypeScript",
          },
        }
      : {}),
  };
  const root = framework
    ? { name: `${SITE_NAME} for ${frameworkLabel(framework)}`, item: absoluteUrl(frameworkHref(framework)) }
    : { name: SITE_NAME, item: SITE_URL };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [root, { name: title, item: url }].map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      ...crumb,
    })),
  };
  return [article, breadcrumb];
}

/** JSON for a <script> body: `<` is escaped so the text can't close the tag. */
export const jsonForScript = (value: unknown): string => JSON.stringify(value).replaceAll("<", "\\u003c");
