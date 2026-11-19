import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { mdxToMdast } from "satteri";
import { describe, expect, it } from "vitest";

import { createDemos, demoEntry } from "./demos";

// A demos folder with masks/contact in both frameworks and history/undo in React only.
const root = mkdtempSync(join(tmpdir(), "forms-demos-"));
const demosDir = join(root, "src/demos/");
for (const entry of [demoEntry("react", "masks/contact"), demoEntry("solid", "masks/contact"), demoEntry("react", "history/undo")]) {
  const file = join(demosDir, entry);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, "export default function Demo() {}\n");
}
const page = pathToFileURL(join(root, "src/content/docs/plugins/masks.mdx"));

function compile(source: string, frontmatter: Record<string, unknown> = {}) {
  return mdxToMdast(source, {
    mdastPlugins: [createDemos(demosDir)],
    fileURL: page,
    data: { astro: { frontmatter, headings: [], localImagePaths: new Set(), remoteImagePaths: new Set() } },
  });
}

type Tree = ReturnType<typeof compile>;
type Child = Tree["children"][number];

const esm = (tree: Tree) =>
  tree.children
    .filter((node): node is Extract<Child, { type: "mdxjsEsm" }> => node.type === "mdxjsEsm")
    .map((node) => node.value)
    .join("\n");

function demoElement(tree: Tree) {
  const demo = tree.children.find((node) => node.type === "mdxJsxFlowElement" && node.name === "Demo");
  if (!demo || demo.type !== "mdxJsxFlowElement") throw new Error("no <Demo> in the tree");
  return demo;
}

/** Each child of the `<Demo>` as `name slot=… client:…`. */
const slots = (tree: Tree) =>
  demoElement(tree).children.map((child) =>
    child.type === "mdxJsxFlowElement"
      ? [
          child.name,
          ...child.attributes.map((attribute) =>
            "name" in attribute
              ? `${attribute.name}${typeof attribute.value === "string" ? `=${attribute.value}` : ""}`
              : "?",
          ),
        ].join(" ")
      : child.type,
  );

describe("demos", () => {
  it("imports each framework's demo and passes it as a hydrated slot", () => {
    const tree = compile(`# Masks\n\n<Demo name="masks/contact" />\n`);
    expect(esm(tree)).toContain(`import Demo1React from "../../../demos/react/masks/contact/contact.tsx";`);
    expect(esm(tree)).toContain(`import Demo1Solid from "../../../demos/solid/masks/contact/contact.tsx";`);
    expect(slots(tree)).toEqual(["Demo1React slot=react client:visible", "Demo1Solid slot=solid client:visible"]);
  });

  it("keeps the <Demo> attributes", () => {
    const demo = demoElement(compile(`<Demo name="masks/contact" form="signup" />\n`));
    expect(demo.attributes.map((attribute) => ("value" in attribute ? attribute.value : null))).toEqual([
      "masks/contact",
      "signup",
    ]);
  });

  it("imports only the frameworks the page lists", () => {
    const tree = compile(`<Demo name="history/undo" />\n`, { frameworks: ["react"] });
    expect(esm(tree)).not.toContain("solid");
    expect(slots(tree)).toEqual(["Demo1React slot=react client:visible"]);
  });

  it("numbers several demos on one page", () => {
    const tree = compile(`<Demo name="masks/contact" />\n\n<Demo name="masks/contact" />\n`);
    expect(esm(tree)).toContain("import Demo2Solid");
  });

  it("fails with file and line when a listed framework has no demo", () => {
    expect(() => compile(`# Undo\n\nText.\n\n<Demo name="history/undo" />\n`)).toThrow(
      /masks\.mdx:5:1: <Demo name="history\/undo"> has no solid demo.*src\/demos\/solid\/history\/undo\/undo\.tsx/,
    );
  });

  it("ignores frameworks that have no pages yet", () => {
    expect(() => compile(`<Demo name="masks/contact" />\n`, { frameworks: ["react", "solid", "vue"] })).not.toThrow();
  });

  it("fails on a missing or computed name", () => {
    expect(() => compile(`<Demo />\n`)).toThrow(/needs name/);
    expect(() => compile(`<Demo name={"masks/contact"} />\n`)).toThrow(/needs name/);
    expect(() => compile(`<Demo name="../secrets" />\n`)).toThrow(/needs name/);
  });

  it("leaves pages without demos alone", () => {
    expect(esm(compile(`# Title\n\nText.\n`))).toBe("");
  });
});
