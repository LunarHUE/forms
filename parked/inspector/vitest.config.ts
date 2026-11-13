import { packageTests } from "../../vitest.base.ts";

const base = packageTests();

export default {
  ...base,
  test: { ...base.test, environment: "jsdom" },
};
