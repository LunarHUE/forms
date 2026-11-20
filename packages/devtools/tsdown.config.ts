import type { UserConfig } from "tsdown";
import { libraryBuild } from "../../tsdown.base.ts";
import { panelCss } from "./panel-css.ts";

// The collector builds unbundled like every package. The panel is the one
// file the collector imports lazily, so it builds on its own as a single
// chunk with Preact inlined: the base config never bundles dependencies, and
// an app shouldn't need Preact installed. Core stays external, so the panel
// reads the same core the app's forms use. Its TSX compiles to Preact's
// automatic runtime, from `jsxImportSource` in tsconfig.build.json; the
// collector has no JSX. Its Tailwind stylesheet compiles in `panelCss()`.
const panelEntry = "src/panel.tsx";

/** Leaves the collector's `import("./panel.js")` to the panel build. */
const panelExternal = {
  name: "lunarhue:panel-external",
  resolveId: (source: string) => (source === "./panel.js" ? { id: source, external: true } : null),
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
      plugins: [panelCss(), ...[build.plugins ?? []].flat()],
      deps: { neverBundle: [/^@lunarhue\/forms-core(\/|$)/], alwaysBundle: [/^preact(\/|$)/, /^lucide-preact$/], onlyBundle: [/^preact(\/|$)/, /^lucide-preact$/] },
    },
  ];
});
