import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { defaultClientConditions, defaultServerConditions } from "vite";

// Workspace packages export their source under this condition, so the docs
// build the library from source and need no package build first.
const sourceCondition = "@lunarhue/source";

export default defineConfig({
  site: "https://forms.lunarhue.dev",
  trailingSlash: "never",
  build: { format: "file" },
  // Internal links fetch their page on hover.
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  integrations: [
    mdx(),
    react({
      include: [
        "**/src/components/**",
        "**/src/devtools/**",
        "**/src/demos/react/**",
        "**/src/layouts/**",
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: { conditions: [sourceCondition, ...defaultClientConditions] },
    ssr: {
      resolve: { conditions: [sourceCondition, ...defaultServerConditions] },
      // The source entries are TypeScript, so they go through Vite's SSR transform.
      noExternal: [/^@lunarhue\//],
    },
  },
});
