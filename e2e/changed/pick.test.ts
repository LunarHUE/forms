import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type FrameworkApp, isDocs, pickFrameworks, type WorkspacePackage } from "./pick.js";
import { readWorkspace } from "./workspace.js";

// A workspace shaped like the real one, with a pretend Vue app as a third
// framework, so "React and Solid changed" can be shown to skip Vue.
const packages: WorkspacePackage[] = [
  { name: "core", dir: "packages/core", dependsOn: [] },
  { name: "schema", dir: "packages/schema", dependsOn: ["core"] },
  { name: "bind", dir: "packages/bind", dependsOn: ["core"] },
  { name: "react", dir: "packages/react", dependsOn: ["core"] },
  { name: "solid", dir: "packages/solid", dependsOn: ["core", "schema"] },
  { name: "vue", dir: "packages/vue", dependsOn: ["core"] },
  { name: "docs", dir: "apps/docs", dependsOn: ["react", "solid", "schema", "bind"] },
  { name: "e2e", dir: "e2e", dependsOn: ["core", "schema", "bind"] },
  { name: "e2e-react", dir: "e2e/apps/react", dependsOn: ["e2e", "react"] },
  { name: "e2e-solid", dir: "e2e/apps/solid", dependsOn: ["e2e", "solid"] },
  { name: "e2e-vue", dir: "e2e/apps/vue", dependsOn: ["e2e", "vue"] },
];

const apps: FrameworkApp[] = [
  { framework: "react", packageName: "e2e-react" },
  { framework: "solid", packageName: "e2e-solid" },
  { framework: "vue", packageName: "e2e-vue" },
];

const pick = (...changed: string[]) => pickFrameworks(changed, packages, apps).frameworks;

describe("pickFrameworks", () => {
  it.each([
    ["core", "packages/core/src/store.ts"],
    ["schema", "packages/schema/src/valibot.ts"],
    ["bind", "packages/bind/src/zustand.ts"],
    ["a spec", "e2e/specs/basic.spec.ts"],
    ["the shared data", "e2e/contract/scenarios/basic.ts"],
    ["the suite's config", "e2e/playwright.config.ts"],
    ["root config", "tsconfig.base.json"],
    ["the root package.json", "package.json"],
    ["the lockfile", "bun.lock"],
    ["a file in a directory that isn't a package", ".github/workflows/ci.yml"],
  ])("runs every framework when %s changes", (_, file) => {
    expect(pick(file)).toEqual(["react", "solid", "vue"]);
  });

  it("runs React alone when only the React adapter changes", () => {
    expect(pick("packages/react/src/forms.ts", "packages/react/src/field.ts")).toEqual(["react"]);
  });

  it("runs Solid alone when only the Solid adapter changes", () => {
    expect(pick("packages/solid/src/forms.ts")).toEqual(["solid"]);
  });

  it("runs React and Solid, and skips Vue, when both of those adapters change", () => {
    expect(pick("packages/react/src/forms.ts", "packages/solid/src/forms.ts")).toEqual(["react", "solid"]);
  });

  it("runs only a framework whose own app changed", () => {
    expect(pick("e2e/apps/solid/src/pages/basic.tsx")).toEqual(["solid"]);
  });

  it("runs a third framework on its own", () => {
    expect(pick("packages/vue/src/index.ts")).toEqual(["vue"]);
  });

  it("runs nothing for docs alone, wherever they are", () => {
    expect(pick("CONTRIBUTING.md", "README.md", "packages/react/README.md", ".changeset/brave-cats.md")).toEqual([]);
  });

  it("ignores docs next to code", () => {
    expect(pick("packages/solid/README.md", "packages/solid/src/forms.ts")).toEqual(["solid"]);
  });

  it("runs nothing for a package no app depends on", () => {
    expect(pick("apps/docs/src/pages/index.astro")).toEqual([]);
  });

  it("runs nothing when nothing changed", () => {
    expect(pickFrameworks([], packages, apps)).toEqual({ frameworks: [], reasons: ["Nothing changed."] });
  });

  it("says why it ran each framework and skipped the others", () => {
    expect(pickFrameworks(["packages/schema/src/zod.ts"], packages, apps).reasons).toEqual([
      "react: schema changed (packages/schema/src/zod.ts), and e2e-react depends on it through e2e.",
      "solid: schema changed (packages/schema/src/zod.ts), and e2e-solid depends on it through e2e.",
      "vue: schema changed (packages/schema/src/zod.ts), and e2e-vue depends on it through e2e.",
    ]);
    expect(pickFrameworks(["packages/react/src/forms.ts"], packages, apps).reasons).toEqual([
      "react: react changed (packages/react/src/forms.ts), and e2e-react depends on it.",
      "solid: skipped, nothing e2e-solid depends on changed.",
      "vue: skipped, nothing e2e-vue depends on changed.",
    ]);
    expect(pickFrameworks(["bun.lock"], packages, apps).reasons).toEqual([
      "Everything: bun.lock is outside every workspace package.",
    ]);
    expect(pickFrameworks(["CONTRIBUTING.md"], packages, apps).reasons).toEqual(["Only docs changed (1 files)."]);
  });

  it("puts a file in the innermost of two nested packages", () => {
    expect(pick("e2e/apps/react/vite.config.ts")).toEqual(["react"]);
    expect(pick("e2e/vite.base.ts")).toEqual(["react", "solid", "vue"]);
  });
});

describe("isDocs", () => {
  it.each([
    "README.md",
    "packages/core/CHANGELOG.md",
    ".changeset/x.md",
    "LICENSE",
    ".github/ISSUE_TEMPLATE/bug.yml",
  ])("counts %s as docs", (file) => expect(isDocs(file)).toBe(true));

  it.each([
    "package.json",
    "packages/core/src/index.ts",
    "docs-site/index.ts",
    "apps/docs/src/content/docs/install.mdx",
    "e2e/contract/styles.css",
    ".github/workflows/ci.yml",
  ])("counts %s as code", (file) => expect(isDocs(file)).toBe(false));
});

describe("readWorkspace", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const workspace = readWorkspace(root);
  const named = (name: string) => workspace.find((entry) => entry.name === name);

  it("reads every app's dependencies from its package.json", () => {
    expect(named("@lunarhue/forms-e2e-react")?.dependsOn).toEqual(
      expect.arrayContaining(["@lunarhue/forms-e2e", "@lunarhue/forms-react"]),
    );
    expect(named("@lunarhue/forms-e2e-solid")?.dependsOn).toEqual(
      expect.arrayContaining(["@lunarhue/forms-e2e", "@lunarhue/forms-solid"]),
    );
  });

  it("maps the real workspace the way the table in issue 69 says", () => {
    const realApps: FrameworkApp[] = [
      { framework: "react", packageName: "@lunarhue/forms-e2e-react" },
      { framework: "solid", packageName: "@lunarhue/forms-e2e-solid" },
    ];
    const real = (...changed: string[]) => pickFrameworks(changed, workspace, realApps).frameworks;
    expect(real("packages/core/src/store.ts")).toEqual(["react", "solid"]);
    expect(real("packages/schema/src/valibot.ts")).toEqual(["react", "solid"]);
    expect(real("packages/bind/src/zustand.ts")).toEqual(["react", "solid"]);
    expect(real("packages/react/src/forms.ts")).toEqual(["react"]);
    expect(real("packages/solid/src/forms.ts")).toEqual(["solid"]);
    expect(real("packages/core/README.md")).toEqual([]);
  });
});
