import { fileURLToPath } from "node:url";

import { defineMdastPlugin } from "satteri";

import { FRAMEWORK_IDS, isFramework, type Framework } from "../frameworks";
import { enclosingFramework, fail } from "./framework-blocks";

/** Fence meta as `<Code>` takes it. */
export interface FenceMeta {
  title?: string;
  framework?: Framework;
  lineNumbers?: boolean;
}

/**
 * Read a fence's meta string, the part after the language:
 *
 *     ```tsx title="contact.tsx" framework=solid lineNumbers
 *
 * `title` and `framework` take a value, quoted or not. A framework that isn't
 * in the list is returned as `invalid` so the plugin can fail with a line.
 */
export function parseMeta(meta: string): FenceMeta & { invalid?: string } {
  const result: FenceMeta & { invalid?: string } = {};
  for (const match of meta.matchAll(/(\w+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g)) {
    const [, key, ...values] = match;
    const value = values.find((v) => v !== undefined);
    if (key === "title" && value) result.title = value;
    else if (key === "framework" && value) {
      if (isFramework(value)) result.framework = value;
      else result.invalid = value;
    } else if (key === "lineNumbers" && value === undefined) result.lineNumbers = true;
  }
  return result;
}

/** Code that only runs in one framework: an adapter package or one of its subpaths. */
export const ADAPTER_IMPORT = /@lunarhue\/forms-(react|solid)\b/;

/**
 * Only the framework-scoped pages under `content/docs/` render per
 * framework. The errors page renders once, and its samples quote adapter
 * error messages, so the guard leaves it alone.
 */
function perFramework(fileURL: URL | undefined): boolean {
  if (!fileURL) return true;
  return fileURLToPath(fileURL).replaceAll("\\", "/").includes("/src/content/docs/");
}

type Attribute = { type: "mdxJsxAttribute"; name: string; value: string | null };

/** A `null` value is a bare boolean attribute. */
const attribute = (name: string, value: string | null = null): Attribute => ({
  type: "mdxJsxAttribute",
  name,
  value,
});

/**
 * Turn each fenced code block into `<Code code lang title framework />`, so
 * fences go through `highlight()` and `CodeBlock` instead of Astro's built-in
 * Shiki. The page passes `Code` in MDX `components`.
 *
 * A fence tagged `framework=react` renders on React pages only. An untagged
 * fence renders on every framework's page, so one that imports
 * `@lunarhue/forms-react` or `@lunarhue/forms-solid` fails the build unless
 * it's tagged or sits inside `<Only framework>`: otherwise the Solid page
 * would show React code.
 *
 * Only register this for MDX. Plain markdown can't hold JSX nodes.
 */
export const codeFences = defineMdastPlugin({
  name: "forms-code-fences",
  options: { position: true },
  code(node, ctx) {
    const meta = parseMeta(node.meta ?? "");
    if (meta.invalid !== undefined) {
      fail(ctx, node, `fence has framework=${meta.invalid}; use one of ${FRAMEWORK_IDS.join(", ")}`);
    }
    const only = enclosingFramework(ctx, node);
    if (only && meta.framework && meta.framework !== only) {
      fail(ctx, node, `fence tagged framework=${meta.framework} sits inside <Only framework="${only}"> and never renders`);
    }
    if (!meta.framework && !only && perFramework(ctx.fileURL)) {
      const adapter = ADAPTER_IMPORT.exec(node.value)?.[0];
      if (adapter) {
        fail(
          ctx,
          node,
          `this fence mentions ${adapter} but renders on every framework's page. ` +
            "Tag it (```tsx framework=react) or put it inside <Only framework=\"react\">.",
        );
      }
    }
    ctx.replaceNode(node, {
      type: "mdxJsxFlowElement",
      name: "Code",
      attributes: [
        attribute("code", node.value),
        attribute("lang", node.lang ?? "text"),
        ...(meta.title ? [attribute("title", meta.title)] : []),
        ...(meta.framework ? [attribute("framework", meta.framework)] : []),
        ...(meta.lineNumbers ? [attribute("lineNumbers")] : []),
      ],
      children: [],
    });
  },
});
