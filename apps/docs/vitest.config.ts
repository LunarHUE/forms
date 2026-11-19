import { defineProject } from "vitest/config";

// Unit tests of the docs' modules: URLs, navigation and the settings store. Pages are
// checked by the build.
export default defineProject({
  test: {
    name: "@lunarhue/forms-docs",
    include: ["src/**/*.test.ts"],
  },
});
