import { packageTests } from "../../vitest.base.ts";

// Solid's browser build. Vite turns the second condition into `development`,
// or `production` when NODE_ENV is production.
const config = packageTests({ conditions: ["browser", "development|production"] });

// The type tests that use JSX are .test-d.tsx files. Vitest still parses
// them to find the tests, and can't parse the JSX that the tsconfig's
// `jsx: preserve` leaves in, so Vite compiles JSX itself. Nothing runs it.
export default {
  ...config,
  oxc: { jsx: { runtime: "automatic", importSource: "@solidjs/web" } },
  test: {
    ...config.test,
    typecheck: { ...config.test?.typecheck, include: ["src/**/*.test-d.ts", "src/**/*.test-d.tsx"] },
  },
};
