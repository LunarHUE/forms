import { existsSync } from "node:fs";
import { dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { defineMdastPlugin } from "satteri";

import { AVAILABLE_FRAMEWORKS, isFramework, type Framework } from "../frameworks";
import { fail, literal } from "./framework-blocks";

/** Demos live in `src/demos/<framework>/<name>/<leaf>.tsx`. */
export const DEMOS_DIR = fileURLToPath(new URL("../../demos/", import.meta.url));

/** A demo name: lowercase path segments, like `masks/contact`. */
const NAME = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;

/** The entry file of a demo, relative to the demos folder. */
export const demoEntry = (framework: Framework, name: string): string =>
  `${framework}/${name}/${name.split("/").at(-1)}.tsx`;

/** What the plugin keeps per page while it runs, keyed by the page's data bag. */
interface PageState {
  count: number;
  imports: string[];
}
const pages = new WeakMap<object, PageState>();

interface AstroData {
  frontmatter?: Record<string, unknown>;
}

/**
 * The frameworks a page renders for, from its frontmatter. The content schema
 * defaults `frameworks` to every available one, and the frontmatter seen here
 * is raw, so the default is repeated. Frameworks without pages (Vue for now)
 * need no demo.
 */
function pageFrameworks(data: AstroData | undefined): Framework[] {
  const listed = data?.frontmatter?.frameworks;
  const frameworks = Array.isArray(listed)
    ? listed.filter((value): value is Framework => typeof value === "string" && isFramework(value))
    : [...AVAILABLE_FRAMEWORKS];
  return frameworks.filter((framework) => AVAILABLE_FRAMEWORKS.includes(framework));
}

/**
 * Make the `demos` plugin. `dir` is the demos folder; tests point it elsewhere.
 *
 * Astro only hydrates a component it can trace to an import in the same file,
 * so `Demo.astro` can't look a demo up by name when it renders. The plugin
 * writes the imports into the page instead, as if the author had typed them:
 *
 *     import Demo1React from "../../demos/react/masks/contact/contact.tsx";
 *     import Demo1Solid from "../../demos/solid/masks/contact/contact.tsx";
 *     <Demo name="masks/contact">
 *       <Demo1React slot="react" client:visible />
 *       <Demo1Solid slot="solid" client:visible />
 *     </Demo>
 *
 * Only the frameworks the page lists get an import. One of them without its
 * demo fails the build with the file and line of the `<Demo>`.
 */
export function createDemos(dir: string = DEMOS_DIR) {
  return defineMdastPlugin({
    name: "forms-demos",
    options: { position: true },
    mdxJsxFlowElement(node, ctx) {
      if (node.name !== "Demo") return;
      if (node.children.length > 0) fail(ctx, node, "<Demo> takes no children; the demos plugin fills them in");
      const name = literal(node, "name");
      if (name === undefined || !NAME.test(name)) {
        fail(ctx, node, `<Demo> needs name as a string literal like "masks/contact", got ${JSON.stringify(name)}`);
      }

      const page = ctx.fileURL ? dirname(fileURLToPath(ctx.fileURL)) : dir;
      const specifier = (path: string) => {
        const relativePath = relative(page, path).replaceAll("\\", "/");
        return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
      };

      let state = pages.get(ctx.data);
      if (!state) pages.set(ctx.data, (state = { count: 0, imports: [] }));
      const count = ++state.count;
      const imports: string[] = [];
      const children: string[] = [];
      for (const framework of pageFrameworks(ctx.data.astro as AstroData | undefined)) {
        const entry = demoEntry(framework, name);
        const file = `${dir}${entry}`;
        if (!existsSync(file)) {
          fail(
            ctx,
            node,
            `<Demo name="${name}"> has no ${framework} demo. The page lists ${framework} in frameworks, so add src/demos/${entry}.`,
          );
        }
        const component = `Demo${count}${framework.charAt(0).toUpperCase()}${framework.slice(1)}`;
        imports.push(`import ${component} from ${JSON.stringify(specifier(file))};`);
        children.push(`<${component} slot="${framework}" client:visible />`);
      }

      // Imports have to sit at the top level of the module.
      state.imports.push(...imports);
      const attributes = node.attributes
        .map((attribute) =>
          attribute.type === "mdxJsxAttribute" && typeof attribute.value === "string"
            ? `${attribute.name}=${JSON.stringify(attribute.value)}`
            : "",
        )
        .filter(Boolean)
        .join(" ");
      ctx.replaceNode(node, { raw: `<Demo ${attributes}>\n${children.join("\n")}\n</Demo>` });
    },
    after(root, ctx) {
      const imports = pages.get(ctx.data)?.imports;
      if (imports?.length) ctx.prependChild(root, { raw: imports.join("\n") });
    },
  });
}

/** `<Demo name="masks/contact" />` becomes the page's live demo for each framework. */
export const demos = createDemos();
