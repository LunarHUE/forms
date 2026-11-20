import type { UserConfig } from "tsdown";
import { libraryBuild } from "../../tsdown.base.ts";

// The collector builds unbundled like every package. The panel is the one
// file the collector imports lazily, so it builds on its own as a single
// chunk with Preact inlined: the base config never bundles dependencies, and
// an app shouldn't need Preact installed. Core stays external, so the panel
// reads the same core the app's forms use.
const panelEntry = "src/panel.ts";

/** Leaves the collector's `import("./panel.js")` to the panel build. */
const panelExternal = {
  name: "lunarhue:panel-external",
  resolveId: (source: string) => (source === "./panel.js" ? { id: source, external: true } : null),
};

/**
 * Minifies the panel's stylesheet, which is a template literal the bundler
 * keeps as written: drops comments, and the spaces around braces,
 * semicolons, commas, child combinators and after colons. A space before a
 * colon stays, since in `.root ::-webkit-scrollbar` it is a combinator.
 */
const minifyCss = {
  name: "lunarhue:minify-css",
  transform: (code: string, id: string) =>
    id.endsWith("/panel/styles.ts")
      ? code.replace(/`[^`]*`/, (css) =>
          css
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\s*([{};,>])\s*/g, "$1")
            .replace(/:\s+/g, ":")
            .replace(/\s+/g, " ")
            .replace(/;}/g, "}"),
        )
      : null,
};

// The Vite plugin is ESM only, like Vite: its worker loads its own file by
// `import.meta.url`.
const viteEntries = ["!src/vite.ts", "!src/vite/**"];

export default libraryBuild().flatMap((build): UserConfig[] => {
  const entry = Array.isArray(build.entry) ? build.entry : [];
  const esmOnly = build.format === "cjs" ? viteEntries : [];
  return [
    { ...build, entry: [...entry, `!${panelEntry}`, "!src/panel/**", ...esmOnly], plugins: [panelExternal, ...[build.plugins ?? []].flat()] },
    {
      ...build,
      entry: { panel: panelEntry },
      unbundle: false,
      clean: false,
      plugins: [minifyCss, ...[build.plugins ?? []].flat()],
      deps: { neverBundle: [/^@lunarhue\/forms-core(\/|$)/], alwaysBundle: [/^preact(\/|$)/], onlyBundle: [/^preact(\/|$)/] },
    },
  ];
});
