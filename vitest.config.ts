import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The Solid adapter compiles JSX differently for its server rendering and
    // hydration tests, so each has a project of its own. Examples join only
    // when they have a vitest config.
    projects: [
      "packages/*",
      "packages/solid/vitest.ssr.config.ts",
      "packages/solid/vitest.hydrate.config.ts",
      "examples/*/*/vitest.config.ts",
    ],
  },
});
