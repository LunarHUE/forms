import { satteri } from "@astrojs/markdown-satteri";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { defaultClientConditions, defaultServerConditions } from "vite";

// Swap for `@astrojs/solid-js` once 8.x (Solid 2) is on npm.
import solid from "./integrations/solid";
import { codeFences } from "./src/lib/mdx/code-fences";
import { frameworkBlocks } from "./src/lib/mdx/framework-blocks";

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
    // Fences become <Code> (highlighted by lib/highlight.ts, filtered by
    // framework); framework-blocks records which headings sit in <Only>.
    mdx({ processor: satteri({ mdastPlugins: [codeFences, frameworkBlocks] }) }),
    // Each renderer only takes its own folders. Both compile .tsx, so an
    // overlap would hand a component to the wrong JSX transform.
    react({
      include: [
        "**/src/components/**",
        "**/src/devtools/**",
        "**/src/demos/react/**",
        "**/src/layouts/**",
      ],
    }),
    solid({ include: ["**/src/demos/solid/**"] }),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: { conditions: [sourceCondition, ...defaultClientConditions] },
    ssr: {
      resolve: { conditions: [sourceCondition, ...defaultServerConditions] },
      // The source entries are TypeScript, so they go through Vite's SSR transform.
      noExternal: [/^@lunarhue\//],
    },
    // Astro builds static pages in its own `prerender` environment, which
    // doesn't read the `ssr` options above.
    environments: {
      prerender: {
        resolve: {
          conditions: [sourceCondition, ...defaultServerConditions],
          noExternal: [/^@lunarhue\//],
        },
      },
    },
  },
});
