import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { docRedirects, MOVED } from "./redirects";

const DOCS_DIR = fileURLToPath(new URL("../content/docs/", import.meta.url));
const isPage = (slug: string) => existsSync(`${DOCS_DIR}${slug}.mdx`);

describe("MOVED", () => {
  it.each(Object.entries(MOVED))("%s points at a page that exists", (from, to) => {
    expect(isPage(to)).toBe(true);
    expect(isPage(from)).toBe(false);
  });

  it("never points at a slug that moved again", () => {
    for (const to of Object.values(MOVED)) expect(MOVED[to]).toBeUndefined();
  });
});

describe("docRedirects", () => {
  it("redirects the old URL in every framework", () => {
    expect(docRedirects({ "concepts/fields": "basics/fields" })).toEqual({
      "/react/concepts/fields": "/react/basics/fields",
      "/solid/concepts/fields": "/solid/basics/fields",
    });
  });
});
