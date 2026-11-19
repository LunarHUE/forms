import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// `sample.tsx` is the root README's example. `astro check` compiles it with
// the docs app, and this test keeps the README's copy the same text.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/** The first tsx fence under the README's "What it looks like" heading. */
function readmeSample(readme: string): string {
  const section = readme.slice(readme.indexOf("## What it looks like"));
  const match = /```tsx\n([\s\S]*?)```/.exec(section);
  if (!match?.[1]) throw new Error("README.md has no tsx block under 'What it looks like'.");
  return match[1];
}

describe("README example", () => {
  it("is sample.tsx, word for word", () => {
    expect(readmeSample(read("../../../../README.md"))).toBe(read("./sample.tsx"));
  });
});
