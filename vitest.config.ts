import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The Solid adapter compiles JSX differently for its server rendering and
    // hydration tests, so each has a project of its own.
    projects: ["packages/*", "packages/solid/vitest.ssr.config.ts", "packages/solid/vitest.hydrate.config.ts"],
  },
});
