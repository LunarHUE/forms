import { expect, it, vi } from "vitest";

// Loading the testing helper from here fails the import, so the test fails
// if any other entry imports it, directly or through another module.
vi.mock("./plugins/testing.js", () => {
  throw new Error("An entry loaded the testing helper.");
});

declare global {
  interface ImportMeta {
    glob(patterns: string | readonly string[], options: { readonly query: "?raw"; readonly import: "default"; readonly eager: true }): Record<string, string>;
  }
}

const manifest = Object.values(import.meta.glob("../package.json", { query: "?raw", import: "default", eager: true }))[0] ?? "{}";

/** The source file of each entry in package.json, as `./plugins/index.ts`, read from its `@lunarhue/source` condition. */
function entrySources(): string[] {
  const parsed: unknown = JSON.parse(manifest);
  const exports: unknown = typeof parsed === "object" && parsed !== null && "exports" in parsed ? parsed.exports : {};
  const sources: string[] = [];
  for (const target of Object.values(exports ?? {})) {
    if (typeof target !== "object" || target === null || !("@lunarhue/source" in target)) continue;
    const source = target["@lunarhue/source"];
    if (typeof source === "string") sources.push(source.replace(/^\.\/src\//, "./"));
  }
  return sources;
}

it("finds every entry in package.json", () => {
  expect(entrySources()).toEqual(["./index.ts", "./plugins/index.ts", "./text/index.ts", "./plugins/testing.ts", "./mini/index.ts"]);
});

it.each(entrySources().filter((source) => source !== "./plugins/testing.ts"))("leaves the testing helper out of %s", async (source) => {
  await expect(import(/* @vite-ignore */ source)).resolves.toBeDefined();
});

it("fails an import that loads the testing helper, as its own entry does", async () => {
  await expect(import("./plugins/testing.js")).rejects.toThrow(/mock/);
});
