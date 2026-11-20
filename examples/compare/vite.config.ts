import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultClientConditions, defineConfig } from "vite";
import { apps, librariesOf } from "./apps.ts";

const root = dirname(fileURLToPath(import.meta.url));

// One multi-page build of every app, for the parity specs. The library is
// built from source, so no package build is needed first.
// scripts/size-compare.ts builds each app on its own from the packages' dist.
export default defineConfig({
  root,
  resolve: { conditions: ["@lunarhue/source", ...defaultClientConditions] },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rolldownOptions: {
      input: Object.fromEntries(
        apps.flatMap((app) =>
          librariesOf(app).map((library) => [`${app.name}-${library.name}`, join(root, app.name, library.name, "index.html")]),
        ),
      ),
    },
  },
  preview: { host: "127.0.0.1", strictPort: true },
});
