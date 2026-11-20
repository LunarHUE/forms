import { satteri } from "@astrojs/markdown-satteri";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { defaultClientConditions, defaultServerConditions } from "vite";

import { pagefindIndex } from "./integrations/pagefind";
// Swap for `@astrojs/solid-js` once 8.x (Solid 2) is on npm.
import solid from "./integrations/solid";
import { codeFences } from "./src/lib/mdx/code-fences";
import { demos } from "./src/lib/mdx/demos";
import { frameworkBlocks } from "./src/lib/mdx/framework-blocks";
import { docRedirects } from "./src/lib/redirects";

// Workspace packages export their source under this condition, so the docs
// build the library from source and need no package build first.
const sourceCondition = "@lunarhue/source";

export default defineConfig({
  site: "https://forms.lunarhue.dev",
  trailingSlash: "never",
  build: { format: "file" },
  // Internal links fetch their page on hover.
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  // Pages that moved keep their old URLs (src/lib/redirects.ts).
  redirects: docRedirects(),
  integrations: [
    // Fences become <Code> (highlighted by lib/highlight.ts, filtered by
    // framework); framework-blocks records which headings sit in <Only>;
    // demos imports each <Demo>'s components (lib/mdx/demos.ts).
    mdx({ processor: satteri({ mdastPlugins: [codeFences, frameworkBlocks, demos] }) }),
    // Each renderer only takes its own folders. Both compile .tsx, so an
    // overlap would hand a component to the wrong JSX transform.
    react({
      // Only JSX files: a bare folder glob also matches CSS imported from
      // these folders, and the dev JSX transform then fails to parse it.
      include: [
        "**/src/components/**/*.{jsx,tsx}",
        "**/src/demos/react/**/*.{jsx,tsx}",
        "**/src/layouts/**/*.{jsx,tsx}",
      ],
    }),
    solid({ include: ["**/src/demos/solid/**/*.{jsx,tsx}"] }),
    // Search index, written to dist/pagefind after the build.
    pagefindIndex(),
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
