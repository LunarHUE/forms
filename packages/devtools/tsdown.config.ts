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

export default libraryBuild().flatMap((build): UserConfig[] => {
  const entry = Array.isArray(build.entry) ? build.entry : [];
  return [
    { ...build, entry: [...entry, `!${panelEntry}`, "!src/panel/**"], plugins: [panelExternal, ...[build.plugins ?? []].flat()] },
    {
      ...build,
      entry: { panel: panelEntry },
      unbundle: false,
      clean: false,
      deps: { neverBundle: [/^@lunarhue\/forms-core(\/|$)/], alwaysBundle: [/^preact(\/|$)/], onlyBundle: [/^preact(\/|$)/] },
    },
  ];
});
