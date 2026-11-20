import { packageTests } from "../../vitest.base.ts";

const base = packageTests();

// The panel mounts into `document.body`, so the tests run in jsdom.
export default { ...base, test: { ...base.test, environment: "jsdom" } };
