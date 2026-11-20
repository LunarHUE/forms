import { describe, expect, it } from "vitest";

import { toMarkdown, type MarkdownPage } from "./markdown";

const page = (body: string, extra: Partial<MarkdownPage> = {}): string =>
  toMarkdown({
    title: "Masks",
    description: "Format input as it is typed.",
    body,
    framework: "react",
    url: "https://forms.lunarhue.dev/react/plugins/masks",
    ...extra,
  });

/** The output after the title, description and source lines. */
const content = (markdown: string): string => markdown.split("\n").slice(6).join("\n");

describe("toMarkdown", () => {
  it("starts with the title, description and source", () => {
    expect(page("Body.")).toBe(
      "# Masks\n\n> Format input as it is typed.\n\nSource: https://forms.lunarhue.dev/react/plugins/masks\n\nBody.\n",
    );
  });

  it("keeps the page's framework blocks and drops the others", () => {
    const body = [
      'import Install from "@/components/mdx/Install.astro";',
      "",
      "Shared.",
      "",
      '<Only framework="react">',
      "",
      "React only.",
      "",
      "</Only>",
      "",
      '<Only framework="solid">',
      "",
      "Solid only.",
      "",
      "```tsx",
      "</Only>",
      "```",
      "",
      "</Only>",
      "",
      "End.",
    ].join("\n");
    expect(content(page(body))).toBe("Shared.\n\nReact only.\n\nEnd.\n");
    expect(content(page(body, { framework: "solid" }))).toBe(
      "Shared.\n\nSolid only.\n\n```tsx\n</Only>\n```\n\nEnd.\n",
    );
  });

  it("drops fences tagged for another framework and the docs-only meta", () => {
    const body = [
      '```ts title="a.ts" framework=react lineNumbers',
      "react();",
      "```",
      "",
      "```ts framework=solid",
      "solid();",
      "```",
    ].join("\n");
    expect(content(page(body))).toBe('```ts title="a.ts"\nreact();\n```\n');
  });

  it("turns a demo into its files", () => {
    const demo = (name: string) => [
      { name: "contact.tsx", code: `// ${name}` },
      { name: "contact.css", code: "a {}" },
    ];
    expect(content(page('<Demo name="masks/contact" />', { demo }))).toBe(
      '```tsx title="contact.tsx"\n// masks/contact\n```\n\n```css title="contact.css"\na {}\n```\n',
    );
  });

  it("fails on a demo with no files", () => {
    expect(() => page('<Demo name="masks/contact" />')).toThrow(/masks\/contact/);
  });

  it("writes install lines as npm commands", () => {
    expect(content(page('<Install adapter packages="zod" />'))).toBe("```bash\nnpm install @lunarhue/forms-react zod\n```\n");
  });

  it("turns a callout into a blockquote", () => {
    const body = '<Callout type="warning" title="Careful">\n\nLine one.\n\n</Callout>';
    expect(content(page(body))).toBe("> **Careful**\n>\n> Line one.\n");
  });

  it("makes links absolute and points docs links at their Markdown", () => {
    const body = "[a](../plugins/rebase) [b](./rules#store) [c](/errors#core:x) [d](#here) [e](https://example.com)";
    expect(content(page(body))).toBe(
      "[a](https://forms.lunarhue.dev/react/plugins/rebase.md) " +
        "[b](https://forms.lunarhue.dev/react/plugins/rules.md#store) " +
        "[c](https://forms.lunarhue.dev/errors.md#core:x) [d](#here) [e](https://example.com)\n",
    );
  });
});
