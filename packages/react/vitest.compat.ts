import type { Plugin } from "vite";
import { configDefaults } from "vitest/config";
import { packageTests } from "../../vitest.base.ts";

/** The React versions the compatibility suite runs on. */
export type ReactMajor = 16 | 17 | 18 | 19;

/** The package entry the suite imports: the main one, or `/legacy`. */
export type Entry = "main" | "legacy";

/**
 * Resolves `react` and `react-dom`, subpaths included, from the fixture
 * package `compat/react-<major>` instead of from this package. The fixture
 * has its own install, so react-dom's own `require("react")` finds the same
 * React as the adapter and the tests. React 16.8 has no JSX runtime, so on 16
 * the tests' JSX goes through `compat/jsx-runtime.ts`.
 */
function reactFrom(major: 16 | 17 | 18): Plugin {
  let fixture = "";
  let jsxRuntime = "";
  return {
    name: "lunarhue:react-version",
    enforce: "pre",
    configResolved(config) {
      fixture = `${config.root}/compat/react-${major}/package.json`;
      jsxRuntime = `${config.root}/compat/jsx-runtime.ts`;
    },
    resolveId(source, _importer, options) {
      if (!/^react(-dom)?(\/|$)/.test(source)) return null;
      if (major === 16 && /^react\/jsx(-dev)?-runtime$/.test(source)) return jsxRuntime;
      return this.resolve(source, fixture, { ...options, skipSelf: true });
    },
  };
}

/**
 * Sends the tests' imports of `../src/index.js` to `src/legacy.ts`, so they
 * run the legacy entry. The legacy entry imports `./index.js`, which this
 * leaves alone.
 */
function legacyEntry(): Plugin {
  let legacy = "";
  return {
    name: "lunarhue:legacy-entry",
    enforce: "pre",
    configResolved(config) {
      legacy = `${config.root}/src/legacy.ts`;
    },
    resolveId(source) {
      return /(^|\/)src\/index\.js$/.test(source) ? legacy : null;
    },
  };
}

/**
 * The compatibility suite under `compat/` on one React version, through one
 * entry. React 16 and 17 need the legacy entry, and 18 and later take
 * either. Unlike the main suite it runs the source as published, without the
 * React Compiler.
 */
export function compatTests(major: ReactMajor, entry: Entry = major < 18 ? "legacy" : "main") {
  const base = packageTests();
  return {
    ...base,
    plugins: [...(major === 19 ? [] : [reactFrom(major)]), ...(entry === "legacy" ? [legacyEntry()] : [])],
    test: {
      ...base.test,
      name: `@lunarhue/forms-react (React ${major}${entry === "legacy" ? ", legacy entry" : ""})`,
      include: ["compat/**/*.test.ts", "compat/**/*.test.tsx"],
      // Only the React 17 project bundles the adapter, see bundle.test.ts.
      exclude: [...configDefaults.exclude, ...(major === 17 ? [] : ["compat/bundle.test.ts"])],
      environment: "jsdom",
      setupFiles: ["./compat/setup.ts"],
      provide: { reactMajor: major, entry },
      // bundle.test.ts writes a bundle here for Node to load as it is.
      server: { deps: { external: [/\/compat\/react-17\/dist\//] } },
      typecheck: { enabled: false },
    },
  };
}
