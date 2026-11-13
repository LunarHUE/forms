import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The Solid adapter compiles JSX differently for its server rendering and
    // hydration tests, so each has a project of its own. The React adapter's
    // compatibility suite has one project per React version. Parked
    // packages keep their tests running here. The e2e project holds the
    // changed-files picker's unit tests, not the browser suite.
    projects: [
      "packages/*",
      "packages/react/vitest.react-*.config.ts",
      "packages/solid/vitest.ssr.config.ts",
      "packages/solid/vitest.hydrate.config.ts",
      "parked/*/vitest.config.ts",
      "e2e/vitest.config.ts",
    ],
  },
});
