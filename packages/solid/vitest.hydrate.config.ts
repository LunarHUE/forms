import solid from "@solidjs/vite-plugin";
import { packageTests } from "../../vitest.base.ts";

// Hydration tests: the browser build in jsdom, with JSX compiled to
// hydratable DOM output, so `hydrate` can adopt the server's markup.
const config = packageTests({ conditions: ["browser", "development|production"] });

export default {
  ...config,
  plugins: [solid({ solid: { hydratable: true } })],
  test: {
    ...config.test,
    name: "@lunarhue/forms-solid hydrate",
    environment: "jsdom",
    include: ["src/**/*.hydrate.test.tsx"],
    typecheck: { enabled: false },
    // The row benchmark runs once, in the main project.
    benchmark: { include: [] },
  },
};
