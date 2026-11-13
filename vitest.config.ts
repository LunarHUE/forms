import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The Solid adapter compiles JSX differently for its server rendering and
    // hydration tests, so each has a project of its own. The React adapter's
    // compatibility suite has one project per React version. Examples join
    // only when they have a vitest config.
    projects: [
      "packages/*",
      "packages/react/vitest.react-*.config.ts",
      "packages/solid/vitest.ssr.config.ts",
      "packages/solid/vitest.hydrate.config.ts",
      "examples/*/*/vitest.config.ts",
    ],
  },
});
