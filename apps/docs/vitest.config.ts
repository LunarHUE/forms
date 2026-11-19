import { defineProject } from "vitest/config";

// Unit tests of the docs' pure modules: URLs, navigation and the MDX
// plugins. Pages are checked by the build.
export default defineProject({
  test: {
    name: "@lunarhue/forms-docs",
    include: ["src/**/*.test.ts"],
  },
});
