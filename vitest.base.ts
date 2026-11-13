import { defaultClientConditions, defaultServerConditions } from "vite";
import { defineProject, type UserWorkspaceConfig } from "vitest/config";

// Workspace packages export their src entry under this condition, so tests
// import sibling packages from source without building them first.
const sourceCondition = "@lunarhue/source";

// Shared test project for every package. Each package's vitest.config.ts is
// `export default packageTests()`.
export function packageTests(): UserWorkspaceConfig {
  return defineProject({
    resolve: { conditions: [sourceCondition, ...defaultClientConditions] },
    ssr: { resolve: { conditions: [sourceCondition, ...defaultServerConditions] } },
    test: {
      include: ["src/**/*.test.ts"],
      typecheck: {
        enabled: true,
        include: ["src/**/*.test-d.ts"],
        tsconfig: "./tsconfig.json",
      },
    },
  });
}
