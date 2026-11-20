import { expect, it } from "vitest";

// Vite fills these in when it loads the test. The packages have no Vite
// types, so this declares the one call used.
declare global {
  interface ImportMeta {
    glob(patterns: string | readonly string[], options: { readonly query: "?raw"; readonly import: "default"; readonly eager: true }): Record<string, string>;
  }
}

// The source of every package, tests and benchmarks left out.
const sources = import.meta.glob(
  ["../../*/src/**/*.{ts,tsx}", "!../../*/src/**/*.test.{ts,tsx}", "!../../*/src/**/*.test-d.{ts,tsx}", "!../../*/src/tests/**", "!../../*/src/bench/**"],
  { query: "?raw", import: "default", eager: true },
);
const pages = import.meta.glob("../../../apps/docs/src/content/errors.mdx", { query: "?raw", import: "default", eager: true });

/** The package a source file is in. Vite writes core's own files from here, as `./store/x.ts`. */
const packageOf = (file: string): string => /^\.\.\/\.\.\/([^/]+)\//.exec(file)?.[1] ?? "core";

/** Every code written in a package's source, as `<package>:<code>`, the anchor errors.mdx gives it. */
function codesInSource(): Set<string> {
  const codes = new Set<string>();
  for (const [file, text] of Object.entries(sources)) {
    const pkg = packageOf(file);
    for (const match of text.matchAll(/["'`]([a-z]+:[a-z]+)["'`]/g)) codes.add(`${pkg}:${match[1]}`);
  }
  return codes;
}

/** Every anchor in apps/docs/src/content/errors.mdx. */
function anchorsInDocs(): Set<string> {
  const page = Object.values(pages)[0] ?? "";
  return new Set([...page.matchAll(/<a id="([^"]+)"><\/a>/g)].map((match) => match[1] ?? ""));
}

it("finds the source of every package and the errors page", () => {
  expect(new Set(Object.keys(sources).map(packageOf))).toEqual(new Set(["bind", "core", "devtools", "react", "schema", "solid", "vue"]));
  expect(anchorsInDocs().size).toBeGreaterThan(0);
});

it("gives every code in source an anchor in errors.mdx, and every anchor a code", () => {
  // Sets compare without order.
  expect(codesInSource()).toEqual(anchorsInDocs());
});
