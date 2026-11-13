import { packageTests } from "../../vitest.base.ts";

const base = packageTests();

// The type tests here use JSX, so they are .test-d.tsx as well as .test-d.ts.
export default {
  ...base,
  test: {
    ...base.test,
    typecheck: { ...base.test?.typecheck, include: ["src/**/*.test-d.ts", "src/**/*.test-d.tsx"] },
  },
};
