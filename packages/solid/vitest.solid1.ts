import { createRequire } from "node:module";
import type { Plugin, Rollup } from "vite";
import { packageTests } from "../../vitest.base.ts";

declare module "vitest" {
  interface ProvidedContext {
    /** The Solid 1 version a project runs on. See src/tests/solid1.ts. */
    solid1: Solid1;
  }
}

/** The Solid 1 versions the `./v1` tests run on: the oldest the peer range takes, and the newest. */
export type Solid1 = "1.8" | "1.9";

/** Which of the main suite's projects to run: jsdom, server rendering or hydration. */
export type Solid1Mode = "dom" | "ssr" | "hydrate";

/** The part of Babel 7 the JSX transform calls. Babel 7 ships no types. */
interface Babel {
  transformAsync(code: string, options: object): Promise<{ readonly code?: string | null; readonly map?: Rollup.SourceMapInput | null } | null>;
}

/** The condition under which `#solid` resolves to Solid 1's calls. See src/solid2.ts. */
const solid1Condition = "@lunarhue/solid1";

/**
 * Runs the tests on the Solid 1 of the fixture package `compat/solid-<version>`:
 * `solid-js` and its subpaths resolve from the fixture, the tests' own Solid
 * calls come from src/tests/solid1.ts instead of solid.ts, and the fixture's
 * babel-preset-solid compiles the JSX, so the compiled output matches the
 * `solid-js/web` it calls.
 */
function solid1From(version: Solid1, mode: Solid1Mode): Plugin {
  let fixture = "";
  let babel: Babel | undefined;
  let presets: unknown[] = [];
  return {
    name: "lunarhue:solid-1",
    enforce: "pre",
    configResolved(config) {
      fixture = `${config.root}/compat/solid-${version}/package.json`;
      const require = createRequire(fixture);
      babel = require("@babel/core");
      presets = [
        [require.resolve("@babel/preset-typescript"), { isTSX: true, allExtensions: true, onlyRemoveTypeImports: true }],
        [require.resolve("babel-preset-solid"), { generate: mode === "ssr" ? "ssr" : "dom", hydratable: mode !== "dom" }],
      ];
    },
    resolveId(source, importer, options) {
      if (source === "./solid.js" && importer?.includes("/src/tests/")) return this.resolve("./solid1.ts", importer, options);
      if (source === "../tests/solid.js" && importer?.includes("/src/bench/")) return this.resolve("../tests/solid1.ts", importer, options);
      if (!/^solid-js(\/|$)/.test(source)) return null;
      return this.resolve(source, fixture, { ...options, skipSelf: true });
    },
    async transform(code, id) {
      if (!/\.[jt]sx$/.test(id.split("?")[0] ?? "") || babel === undefined) return null;
      const result = await babel.transformAsync(code, { filename: id, presets, sourceMaps: true, babelrc: false, configFile: false });
      return result?.code == null ? null : { code: result.code, map: result.map ?? null };
    },
  };
}

/** One of the main suite's projects, on Solid `version` and the `./v1` build of the adapter. */
export function solid1Tests(version: Solid1, mode: Solid1Mode) {
  // The jsdom and hydration projects resolve Solid's browser build, as vitest.config.ts does.
  const base = packageTests(mode === "ssr" ? {} : { conditions: ["browser", "development|production"] });
  return {
    ...base,
    resolve: { ...base.resolve, conditions: [solid1Condition, ...(base.resolve?.conditions ?? [])] },
    ssr: { ...base.ssr, resolve: { ...base.ssr?.resolve, conditions: [solid1Condition, ...(base.ssr?.resolve?.conditions ?? [])] } },
    plugins: [solid1From(version, mode)],
    test: {
      ...base.test,
      name: `@lunarhue/forms-solid (Solid ${version}${mode === "dom" ? "" : ` ${mode}`})`,
      environment: mode === "ssr" ? "node" : "jsdom",
      include:
        mode === "dom" ? ["src/**/*.test.ts", "src/**/*.test.tsx"] : mode === "ssr" ? ["src/**/*.ssr.test.tsx"] : ["src/**/*.hydrate.test.tsx"],
      exclude: mode === "dom" ? ["src/**/*.ssr.test.tsx", "src/**/*.hydrate.test.tsx"] : [],
      provide: { solid1: version },
      // The type tests run on Solid 1 through tsconfig.v1.json.
      typecheck: { enabled: false },
      benchmark: { include: [] },
    },
  };
}
