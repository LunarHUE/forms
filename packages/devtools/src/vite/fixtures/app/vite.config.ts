import { fileURLToPath } from "node:url";
import { defaultClientConditions, defineConfig } from "vite";
import { panelCss } from "../../../../panel-css.ts";
import { formsDevtools } from "../../../vite.ts";

export default defineConfig({
  root: import.meta.dirname,
  logLevel: "silent",
  // The panel imports its compiled stylesheet as a virtual module.
  plugins: [panelCss(), formsDevtools()],
  resolve: {
    conditions: ["@lunarhue/source", ...defaultClientConditions],
    // The fixture isn't a workspace package, so it reaches the devtools by path.
    alias: { "@lunarhue/forms-devtools": fileURLToPath(new URL("../../../index.ts", import.meta.url)) },
  },
});
