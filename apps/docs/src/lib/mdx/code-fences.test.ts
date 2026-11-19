import { pathToFileURL } from "node:url";

import { mdxToMdast } from "satteri";
import { describe, expect, it } from "vitest";

import { codeFences, parseMeta } from "./code-fences";

const docsPage = pathToFileURL("/repo/apps/docs/src/content/docs/plugins/masks.mdx");
const errorsPage = pathToFileURL("/repo/apps/docs/src/content/errors.mdx");

async function compile(source: string, fileURL: URL = docsPage) {
  return await mdxToMdast(source, { mdastPlugins: [codeFences], fileURL });
}

/** The attributes of the first `<Code>` element as a plain object. */
async function codeProps(source: string) {
  const tree = await compile(source);
  const code = tree.children.find((node) => node.type === "mdxJsxFlowElement" && node.name === "Code");
  if (!code || code.type !== "mdxJsxFlowElement") throw new Error("no <Code> in the tree");
  return Object.fromEntries(
    code.attributes.map((attribute) => [
      "name" in attribute ? attribute.name : "?",
      "value" in attribute ? attribute.value : undefined,
    ]),
  );
}

const fence = (meta: string, body: string) => `\`\`\`tsx ${meta}\n${body}\n\`\`\`\n`;

describe("parseMeta", () => {
  it("reads title, framework and the lineNumbers flag", () => {
    expect(parseMeta(`title="contact.tsx" framework=solid lineNumbers`)).toEqual({
      title: "contact.tsx",
      framework: "solid",
      lineNumbers: true,
    });
    expect(parseMeta(`framework="react"`)).toEqual({ framework: "react" });
    expect(parseMeta("")).toEqual({});
  });

  it("keeps a title with spaces", () => {
    expect(parseMeta(`title="Phone field.tsx"`)).toEqual({ title: "Phone field.tsx" });
  });

  it("flags a framework it doesn't know", () => {
    expect(parseMeta("framework=svelte")).toEqual({ invalid: "svelte" });
  });
});

describe("codeFences", () => {
  it("turns a fence into <Code> with its source, language and meta", async () => {
    expect(await codeProps(fence(`title="contact.tsx" framework=solid`, "const a = 1;"))).toEqual({
      code: "const a = 1;",
      lang: "tsx",
      title: "contact.tsx",
      framework: "solid",
    });
  });

  it("falls back to text for a fence without a language", async () => {
    expect(await codeProps("```\nplain\n```\n")).toEqual({ code: "plain", lang: "text" });
  });

  it("passes lineNumbers as a boolean attribute", async () => {
    expect(await codeProps(fence("lineNumbers", "x"))).toMatchObject({ lineNumbers: null });
  });

  const reactImport = `import { useForm } from "@lunarhue/forms-react";`;

  it("fails on an untagged fence that imports an adapter, with file and line", async () => {
    const source = `# Title\n\nText.\n\n${fence("", reactImport)}`;
    await expect(compile(source)).rejects.toThrow(/masks\.mdx:5:1: this fence mentions @lunarhue\/forms-react/);
  });

  it("catches adapter subpaths and the Solid adapter", async () => {
    await expect(compile(fence("", `import { mask } from "@lunarhue/forms-solid/plugins/mask";`))).rejects.toThrow(
      /@lunarhue\/forms-solid/,
    );
  });

  it("accepts a tagged fence or one inside <Only>", async () => {
    await expect(compile(fence("framework=react", reactImport))).resolves.toBeDefined();
    await expect(compile(`<Only framework="react">\n\n${fence("", reactImport)}\n</Only>\n`)).resolves.toBeDefined();
  });

  it("leaves pages outside content/docs alone", async () => {
    await expect(compile(fence("", reactImport), errorsPage)).resolves.toBeDefined();
  });

  it("ignores packages that work everywhere", async () => {
    await expect(compile(fence("", `import { mask } from "@lunarhue/forms-core";`))).resolves.toBeDefined();
  });

  it("fails on an unknown framework or a tag that contradicts its <Only>", async () => {
    await expect(compile(fence("framework=svelte", "x"))).rejects.toThrow(/framework=svelte/);
    await expect(compile(`<Only framework="react">\n\n${fence("framework=solid", "x")}\n</Only>\n`)).rejects.toThrow(
      /never renders/,
    );
  });
});
