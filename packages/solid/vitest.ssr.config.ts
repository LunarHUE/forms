import solid from "@solidjs/vite-plugin";
import { packageTests } from "../../vitest.base.ts";

// Server rendering tests: Node's conditions, so `solid-js` and `@solidjs/web`
// resolve to their server builds, and JSX compiles to hydratable SSR output.
const config = packageTests();

export default {
  ...config,
  plugins: [solid({ solid: { hydratable: true } })],
  test: {
    ...config.test,
    name: "@lunarhue/forms-solid ssr",
    environment: "node",
    include: ["src/**/*.ssr.test.tsx"],
    typecheck: { enabled: false },
    // The row benchmark runs once, in the main project.
    benchmark: { include: [] },
  },
};
