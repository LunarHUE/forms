import { describe, expect, it } from "vitest";

import { alternates, pagination, sidebar, type NavPage } from "./nav";

const page = (slug: string, section: NavPage["section"], order: number, extra: Partial<NavPage> = {}): NavPage => ({
  slug,
  title: slug,
  section,
  order,
  frameworks: ["react", "solid"],
  ...extra,
});

// Listed out of order on purpose.
const pages: NavPage[] = [
  page("reference/api", "reference", 1, { title: "API" }),
  page("install", "start", 2, { title: "Install" }),
  page("integrations/zustand", "integrations", 1, { title: "Zustand", frameworks: ["react"] }),
  page("introduction", "start", 1, { title: "Introduction" }),
  page("plugins/masks", "plugins", 3, { title: "Masks" }),
  page("plugins/history", "plugins", 2, { title: "History" }),
  page("first-form", "start", 3, { title: "Your first form", navTitle: "First form" }),
  page("integrations/solid-signals", "integrations", 2, { title: "Solid signals", frameworks: ["solid"] }),
];

const labels = (groups: ReturnType<typeof sidebar>) =>
  groups.map((group) => [group.label, group.items.map((item) => item.label)]);

describe("sidebar", () => {
  it("groups by section in IA order and sorts by order", () => {
    expect(labels(sidebar(pages, "react"))).toEqual([
      ["Start", ["Introduction", "Install", "First form"]],
      ["Plugins", ["History", "Masks"]],
      ["Integrations", ["Zustand"]],
      ["Reference", ["API", "Errors"]],
    ]);
  });

  it("keeps only the framework's pages", () => {
    const integrations = sidebar(pages, "solid").find((group) => group.section === "integrations");
    expect(integrations?.items.map((item) => item.href)).toEqual(["/solid/integrations/solid-signals"]);
  });

  it("breaks order ties by title", () => {
    const tied = [page("b", "start", 1, { title: "Beta" }), page("a", "start", 1, { title: "Alpha" })];
    expect(sidebar(tied, "react")[0]?.items.map((item) => item.label)).toEqual(["Alpha", "Beta"]);
  });

  it("links an older version's pages under its segment", () => {
    expect(sidebar(pages, "react", "0.1.0")[0]?.items[0]?.href).toBe("/react/0.1.0/introduction");
  });
});

describe("pagination", () => {
  const groups = sidebar(pages, "react");

  it("crosses section boundaries", () => {
    const { previous, next } = pagination(groups, "first-form");
    expect(previous?.href).toBe("/react/install");
    expect(next?.href).toBe("/react/plugins/history");
  });

  it("has no previous on the first page and ends at Errors", () => {
    expect(pagination(groups, "introduction").previous).toBeUndefined();
    expect(pagination(groups, "reference/api").next?.href).toBe("/errors");
    expect(pagination(groups, "errors").next).toBeUndefined();
  });

  it("skips pages the framework lacks", () => {
    expect(pagination(groups, "integrations/zustand").next?.href).toBe("/react/reference/api");
    expect(pagination(sidebar(pages, "solid"), "plugins/masks").next?.href).toBe("/solid/integrations/solid-signals");
  });

  it("is empty for an unknown slug", () => {
    expect(pagination(groups, "nope")).toEqual({});
  });
});

describe("alternates", () => {
  it("links the same slug in every framework that has it", () => {
    expect(alternates(pages, "plugins/masks")).toEqual([
      { framework: "react", label: "React", available: true, href: "/react/plugins/masks", fallback: false },
      { framework: "solid", label: "Solid", available: true, href: "/solid/plugins/masks", fallback: false },
      { framework: "vue", label: "Vue", available: false, fallback: false },
    ]);
  });

  it("falls back to the introduction where the page is missing", () => {
    const [react, solid] = alternates(pages, "integrations/zustand");
    expect(react).toMatchObject({ href: "/react/integrations/zustand", fallback: false });
    expect(solid).toMatchObject({ href: "/solid/introduction", fallback: true });
  });

  it("keeps the version", () => {
    expect(alternates(pages, "install", "0.1.0")[1]?.href).toBe("/solid/0.1.0/install");
  });
});
