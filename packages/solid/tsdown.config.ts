import type { UserConfig } from "tsdown";
import { libraryBuild } from "../../tsdown.base.ts";

// The adapter imports the Solid calls that differ between majors from
// `#solid` (see src/solid2.ts). Each build resolves that import and compiles
// the file it picks in with the rest, so `dist` binds Solid 2 and `dist/v1`
// binds Solid 1, and neither imports the other's Solid.

/** `config` with `#solid` compiled in, resolved under `conditions`. */
function withRuntime(config: UserConfig, conditions: readonly string[]): UserConfig {
  return {
    ...config,
    deps: { ...config.deps, alwaysBundle: [/^#solid$/] },
    inputOptions: { resolve: { conditionNames: [...conditions, "import", "default"] } },
  };
}

/**
 * The `./v1` build: the adapter from src/index.ts, with Solid 1's calls. Its
 * declarations re-export the main entry's, which name only what both majors
 * export, so the two entries share one set of types.
 */
function solid1Build(config: UserConfig): UserConfig {
  const format = config.format === "cjs" ? "cjs" : "esm";
  return withRuntime(
    {
      ...config,
      entry: ["src/index.ts"],
      outDir: `dist/v1/${format}`,
      plugins: [
        config.plugins,
        {
          name: "lunarhue:v1-types",
          generateBundle() {
            this.emitFile({ type: "asset", fileName: "index.d.ts", source: `export * from "../../${format}/index.js";\n` });
          },
        },
      ],
    },
    ["@lunarhue/solid1"],
  );
}

export default [
  ...libraryBuild().map((config) => {
    const entry = Array.isArray(config.entry) ? config.entry : [];
    return withRuntime({ ...config, entry: [...entry, "!src/solid1.ts", "!src/tests/**"] }, []);
  }),
  ...libraryBuild().map(solid1Build),
];
