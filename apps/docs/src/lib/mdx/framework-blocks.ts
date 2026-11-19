import { relative } from "node:path";
import { fileURLToPath } from "node:url";

import { defineMdastPlugin, type MdastNode, type MdastVisitorContext } from "satteri";

import { FRAMEWORK_IDS, isFramework, type Framework } from "../frameworks";

/** A node as the helpers below read it. Satteri's own types are a large union. */
interface Node {
  type: string;
  attributes?: readonly { type: string; name?: string; value?: unknown }[];
  position?: { start: { line: number; column: number } };
}

/** A string-literal attribute, or undefined for a missing or expression value. */
export function literal(node: Node, name: string): string | undefined {
  const value = node.attributes?.find(
    (attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === name,
  )?.value;
  return typeof value === "string" ? value : undefined;
}

/**
 * Stop the build with the file and line of `node`. `ctx.report` only collects
 * diagnostics, and Astro's MDX pipeline drops them, so a guard has to throw.
 */
export function fail(ctx: MdastVisitorContext, node: Node, message: string): never {
  const file = ctx.fileURL ? relative(process.cwd(), fileURLToPath(ctx.fileURL)) : "<mdx>";
  const start = node.position?.start;
  const where = start ? `${file}:${start.line}:${start.column}` : file;
  throw new Error(`${where}: ${message}`);
}

/** The `framework` of an `<Only>` element, checked against the framework list. */
export function onlyValue(ctx: MdastVisitorContext, node: Node): Framework {
  const value = literal(node, "framework");
  if (value === undefined || !isFramework(value)) {
    fail(ctx, node, `<Only> needs framework set to one of ${FRAMEWORK_IDS.join(", ")} as a string literal`);
  }
  return value;
}

/** The framework of the nearest `<Only>` around `node`, or undefined outside one. */
export function enclosingFramework(ctx: MdastVisitorContext, node: MdastNode): Framework | undefined {
  for (let parent = ctx.parent(node); parent && parent.type !== "root"; parent = ctx.parent(parent)) {
    if (parent.type === "mdxJsxFlowElement" && parent.name === "Only") return onlyValue(ctx, parent);
  }
  return undefined;
}

/** What this plugin adds to a page's frontmatter (`remarkPluginFrontmatter`). */
export interface FrameworkBlocksData {
  /**
   * One entry per markdown heading, in document order, the same order as
   * Astro's `headings`: the framework of the `<Only>` it sits in, or null.
   */
  headingFrameworks: (Framework | null)[];
}

interface AstroData {
  frontmatter: Record<string, unknown> & Partial<FrameworkBlocksData>;
}

/**
 * Record which headings sit inside `<Only framework>`, so the page's table of
 * contents can leave out the other framework's sections. Astro's `headings`
 * lists every heading whatever the framework, and has no way to tell.
 *
 * Also checks every `<Only>`: `framework` must be a string literal naming a
 * known framework, or the build fails.
 */
export const frameworkBlocks = defineMdastPlugin({
  name: "forms-framework-blocks",
  options: { position: true },
  before(_root, ctx) {
    const astro = ctx.data.astro as AstroData | undefined;
    if (astro) astro.frontmatter.headingFrameworks = [];
  },
  heading(node, ctx) {
    const astro = ctx.data.astro as AstroData | undefined;
    astro?.frontmatter.headingFrameworks?.push(enclosingFramework(ctx, node) ?? null);
  },
  mdxJsxFlowElement(node, ctx) {
    if (node.name === "Only") onlyValue(ctx, node);
  },
});

/**
 * The headings a framework's page shows: Astro's `headings` minus those inside
 * another framework's `<Only>`. `data` is `remarkPluginFrontmatter` from
 * `render(entry)`. Without the plugin's data, or if the counts disagree,
 * every heading is kept.
 */
export function headingsFor<H>(
  framework: Framework,
  headings: readonly H[],
  data: Partial<FrameworkBlocksData> | Record<string, unknown> | undefined,
): H[] {
  const frameworks: unknown = data?.headingFrameworks;
  if (!Array.isArray(frameworks) || frameworks.length !== headings.length) return [...headings];
  return headings.filter((_, index) => {
    const only: unknown = frameworks[index];
    return only === null || only === framework;
  });
}
