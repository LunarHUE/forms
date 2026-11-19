import { mdxToJs } from "satteri";
import { describe, expect, it } from "vitest";

import { frameworkBlocks, headingsFor } from "./framework-blocks";

function headingFrameworks(source: string): unknown {
  const astro = { frontmatter: {}, headings: [], localImagePaths: new Set<string>(), remoteImagePaths: new Set<string>() };
  const result = mdxToJs(source, { mdastPlugins: [frameworkBlocks], data: { astro } });
  return result.data.astro?.frontmatter.headingFrameworks;
}

const page = `# Masks

## Display text

<Only framework="react">

## With React state

### Nested

</Only>

<Only framework="solid">
## With signals
</Only>

## Caret
`;

describe("frameworkBlocks", () => {
  it("records the framework of each heading in document order", () => {
    expect(headingFrameworks(page)).toEqual([null, null, "react", "react", "solid", null]);
  });

  it("fails on an <Only> without a known framework", () => {
    expect(() => headingFrameworks(`<Only framework="vue2">\n\n## A\n\n</Only>\n`)).toThrow(
      /<Only> needs framework/,
    );
    expect(() => headingFrameworks(`<Only>\n\ntext\n\n</Only>\n`)).toThrow(/<Only> needs framework/);
  });
});

describe("headingsFor", () => {
  const headings = ["Masks", "Display text", "With React state", "Nested", "With signals", "Caret"];
  const data = { headingFrameworks: [null, null, "react", "react", "solid", null] };

  it("drops the other framework's headings", () => {
    expect(headingsFor("react", headings, data)).toEqual(["Masks", "Display text", "With React state", "Nested", "Caret"]);
    expect(headingsFor("solid", headings, data)).toEqual(["Masks", "Display text", "With signals", "Caret"]);
  });

  it("keeps every heading without the plugin's data or when the counts differ", () => {
    expect(headingsFor("solid", headings, {})).toEqual(headings);
    expect(headingsFor("solid", headings, undefined)).toEqual(headings);
    expect(headingsFor("solid", headings, { headingFrameworks: ["react"] })).toEqual(headings);
  });
});
