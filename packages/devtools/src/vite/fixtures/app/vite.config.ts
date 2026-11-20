import { fileURLToPath } from "node:url";
import { defaultClientConditions, defineConfig } from "vite";
import { formsDevtools } from "../../../vite.ts";

export default defineConfig({
  root: import.meta.dirname,
  logLevel: "silent",
  plugins: [formsDevtools()],
  resolve: {
    conditions: ["@lunarhue/source", ...defaultClientConditions],
    // The fixture isn't a workspace package, so it reaches the devtools by path.
    alias: { "@lunarhue/forms-devtools": fileURLToPath(new URL("../../../index.ts", import.meta.url)) },
  },
});
