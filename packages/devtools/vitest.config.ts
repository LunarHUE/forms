import { packageTests } from "../../vitest.base.ts";
import { panelCss } from "./panel-css.ts";

const base = packageTests();

// The panel mounts into `document.body`, so the tests run in jsdom.
export default { ...base, plugins: [panelCss()], test: { ...base.test, environment: "jsdom" } };
