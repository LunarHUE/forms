import { FRAMEWORKS, type Framework } from "./frameworks";
import { docHref, ERRORS_HREF, INTRODUCTION_SLUG } from "./routes";

/** Sidebar sections in display order. The content schema validates against this list. */
export const SECTION_IDS = [
  "start",
  "basics",
  "composition",
  "plugins",
  "plugin-composition",
  "writing-plugins",
  // No pages yet. Empty sections stay out of the sidebar.
  "compared",
  "integrations",
  "reference",
] as const;

export type Section = (typeof SECTION_IDS)[number];

export const SECTION_LABELS: Record<Section, string> = {
  start: "Start",
  basics: "Basics",
  composition: "Composition",
  plugins: "Plugins",
  "plugin-composition": "Plugins with composition",
  "writing-plugins": "Writing plugins",
  compared: "Compared with TanStack Form",
  integrations: "Integrations",
  reference: "Reference",
};

/** The fields of a docs entry the navigation reads. `content.ts` maps entries to this. */
export interface NavPage {
  readonly slug: string;
  readonly title: string;
  /** Shorter sidebar label. Falls back to the title. */
  readonly navTitle?: string;
  readonly section: Section;
  readonly order: number;
  readonly frameworks: readonly Framework[];
}

export interface NavItem {
  /** The entry id, or `errors` for the errors page. */
  readonly slug: string;
  readonly label: string;
  readonly href: string;
}

export interface NavGroup {
  readonly section: Section;
  readonly label: string;
  readonly items: readonly NavItem[];
}

/** The errors page has no entry in the docs collection, so it joins Reference here. */
const errorsItem: NavItem = { slug: "errors", label: "Errors", href: ERRORS_HREF };

const byOrder = (a: NavPage, b: NavPage) => a.order - b.order || a.title.localeCompare(b.title);

/**
 * The sidebar for one framework: its pages grouped by section in
 * `SECTION_IDS` order, each group sorted by `order` then title. Errors closes
 * Reference. Empty groups are left out.
 */
export function sidebar(pages: readonly NavPage[], framework: Framework, version?: string): NavGroup[] {
  const own = pages.filter((page) => page.frameworks.includes(framework)).toSorted(byOrder);
  return SECTION_IDS.flatMap((section) => {
    const items: NavItem[] = own
      .filter((page) => page.section === section)
      .map((page) => ({
        slug: page.slug,
        label: page.navTitle ?? page.title,
        href: docHref({ framework, version, slug: page.slug }),
      }));
    if (section === "reference") items.push(errorsItem);
    return items.length > 0 ? [{ section, label: SECTION_LABELS[section], items }] : [];
  });
}

export interface Pagination {
  readonly previous?: NavItem;
  readonly next?: NavItem;
}

/** The pages either side of `slug` in the sidebar read top to bottom, across sections. */
export function pagination(groups: readonly NavGroup[], slug: string): Pagination {
  const items = groups.flatMap((group) => group.items);
  const index = items.findIndex((item) => item.slug === slug);
  if (index === -1) return {};
  return { previous: items[index - 1], next: items[index + 1] };
}

export interface Alternate {
  readonly framework: Framework;
  readonly label: string;
  /** False for a coming-soon framework, which has no href. */
  readonly available: boolean;
  readonly href?: string;
  /** True when the framework has no page at this slug and the link goes to its Introduction. */
  readonly fallback: boolean;
}

/**
 * The page at `slug` in every framework, in picker order. A framework without
 * that page links to its Introduction instead.
 */
export function alternates(pages: readonly NavPage[], slug: string, version?: string): Alternate[] {
  const page = pages.find((candidate) => candidate.slug === slug);
  return FRAMEWORKS.map(({ id: framework, label, available }) => {
    if (!available) return { framework, label, available, fallback: false };
    const has = page?.frameworks.includes(framework) ?? false;
    const href = docHref({ framework, version, slug: has ? slug : INTRODUCTION_SLUG });
    return { framework, label, available, href, fallback: !has };
  });
}
