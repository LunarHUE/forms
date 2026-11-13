import { packageTests } from "../../../vitest.base.ts";

const base = packageTests();

// `bumpBadge` touches the DOM, so the tests run in jsdom. Everything else here is plain code.
export default {
  ...base,
  test: { ...base.test, environment: "jsdom" },
};
