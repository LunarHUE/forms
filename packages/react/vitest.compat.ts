import type { Plugin } from "vite";
import { configDefaults } from "vitest/config";
import { packageTests } from "../../vitest.base.ts";

/** The React versions the compatibility suite runs on. */
export type ReactMajor = 16 | 17 | 18 | 19;

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
 * The compatibility suite under `compat/` on one React version. Unlike the
 * main suite it runs the source as published, without the React Compiler.
 */
export function compatTests(major: ReactMajor) {
  const base = packageTests();
  return {
    ...base,
    plugins: major === 19 ? [] : [reactFrom(major)],
    test: {
      ...base.test,
      name: `@lunarhue/forms-react (React ${major})`,
      include: ["compat/**/*.test.ts", "compat/**/*.test.tsx"],
      // Only the React 17 project bundles the adapter, see bundle.test.ts.
      exclude: [...configDefaults.exclude, ...(major === 17 ? [] : ["compat/bundle.test.ts"])],
      environment: "jsdom",
      setupFiles: ["./compat/setup.ts"],
      provide: { reactMajor: major },
      // bundle.test.ts writes a bundle here for Node to load as it is.
      server: { deps: { external: [/\/compat\/react-17\/dist\//] } },
      typecheck: { enabled: false },
    },
  };
}
