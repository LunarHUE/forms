import { describe, expect, it } from "vitest";

import { docHref, errorsHref, frameworkHref, parsePath } from "./routes";
import { LATEST_VERSION } from "./versions";

describe("docHref", () => {
  it("leaves the version out for the latest version", () => {
    expect(docHref({ framework: "react", slug: "plugins/masks" })).toBe("/react/plugins/masks");
    expect(docHref({ framework: "solid", version: LATEST_VERSION, slug: "install" })).toBe("/solid/install");
  });

  it("puts an older version between the framework and the slug", () => {
    expect(docHref({ framework: "solid", version: "0.1.0", slug: "plugins/masks" })).toBe(
      "/solid/0.1.0/plugins/masks",
    );
  });

  it("sends a framework to its introduction", () => {
    expect(frameworkHref("react")).toBe("/react/introduction");
  });
});

describe("errorsHref", () => {
  it("links the page or one code on it", () => {
    expect(errorsHref()).toBe("/errors");
    expect(errorsHref("react:context:form")).toBe("/errors#react:context:form");
  });
});

describe("parsePath", () => {
  it("reads a latest page", () => {
    expect(parsePath("/react/plugins/masks")).toEqual({
      framework: "react",
      version: LATEST_VERSION,
      slug: "plugins/masks",
    });
  });

  it("reads an older version", () => {
    expect(parsePath("/solid/0.1.0/plugins/masks")).toEqual({
      framework: "solid",
      version: "0.1.0",
      slug: "plugins/masks",
    });
  });

  it("ignores a trailing slash and an .html suffix", () => {
    expect(parsePath("/react/install/")).toEqual(parsePath("/react/install"));
    expect(parsePath("/react/install.html")).toEqual(parsePath("/react/install"));
  });

  it("reads a bare framework as its introduction", () => {
    expect(parsePath("/solid")).toEqual({ framework: "solid", version: LATEST_VERSION, slug: "introduction" });
  });

  it("returns undefined outside the docs", () => {
    expect(parsePath("/")).toBeUndefined();
    expect(parsePath("/errors")).toBeUndefined();
    expect(parsePath("/svelte/install")).toBeUndefined();
  });

  it("round-trips docHref", () => {
    const location = { framework: "solid", version: "0.1.0", slug: "concepts/fields" } as const;
    expect(parsePath(docHref(location))).toEqual(location);
  });
});
