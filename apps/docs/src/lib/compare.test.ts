import { describe, expect, it } from "vitest";

import { compareMarkdown, difference, formatBytes, sizeRows, type AppSizes, type CompareBuild } from "./compare";

const size = (gzip: number) => ({ min: gzip * 3, gzip, brotli: gzip - 100 });

const sizes: AppSizes = {
  lunarhue: { forms: size(13388), total: size(80823), app: size(1601) },
  tanstack: { forms: size(19000), total: size(80700), app: size(1601) },
};

const builds: CompareBuild[] = [
  { library: "lunarhue", title: "@lunarhue/forms", version: "0.2.0", files: [{ name: "App.tsx", code: "ours" }] },
  { library: "tanstack", title: "TanStack Form", version: "1.33.5", files: [{ name: "App.tsx", code: "theirs" }] },
];

describe("formatBytes", () => {
  it("prints kilobytes of 1000 bytes with one decimal", () => {
    expect(formatBytes(13388)).toBe("13.4 kB");
    expect(formatBytes(999)).toBe("999 B");
  });
});

describe("difference", () => {
  it("reads as ours against theirs, smaller or larger", () => {
    expect(difference(13388, 19000)).toBe("5.6 kB smaller (30%)");
    expect(difference(97032, 96726)).toBe("306 B larger (0.3%)");
    expect(difference(1601, 1601)).toBe("the same");
  });
});

describe("sizeRows", () => {
  it("lists forms + app, total and app only for the chosen compression", () => {
    expect(sizeRows(sizes, "gzip").map((row) => [row.build, row.difference])).toEqual([
      ["forms", "5.6 kB smaller (30%)"],
      ["total", "123 B larger (0.2%)"],
      ["app", "the same"],
    ]);
    expect(sizeRows(sizes, "min")[0]?.lunarhue).toBe(13388 * 3);
  });
});

describe("compareMarkdown", () => {
  it("writes the sizes table, then each library's files", () => {
    expect(compareMarkdown(builds, sizes)).toBe(
      [
        "| Build (gzip) | @lunarhue/forms is | @lunarhue/forms 0.2.0 | TanStack Form 1.33.5 |",
        "| --- | --- | --- | --- |",
        "| Forms + app | 5.6 kB smaller (30%) | 13.4 kB | 19.0 kB |",
        "| Total | 123 B larger (0.2%) | 80.8 kB | 80.7 kB |",
        "| App only | the same | 1.6 kB | 1.6 kB |",
        "",
        '```tsx title="lunarhue/App.tsx"\nours\n```',
        "",
        '```tsx title="tanstack/App.tsx"\ntheirs\n```',
      ].join("\n"),
    );
  });
});
