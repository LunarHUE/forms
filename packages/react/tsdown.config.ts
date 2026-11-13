import { libraryBuild } from "../../tsdown.base.ts";

// Runtime tests and their helpers live under src too, as .test.tsx files and src/test.
export default libraryBuild().map((config) => ({
  ...config,
  entry: [...(Array.isArray(config.entry) ? config.entry : []), "!src/**/*.test.tsx", "!src/test/**"],
}));
