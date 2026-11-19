import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";
import * as pagefind from "pagefind";

/**
 * Builds the Pagefind search index into `dist/pagefind` once Astro has written
 * the site, so `astro build` alone gives a searchable site.
 *
 * Pagefind only indexes pages that have an element with `data-pagefind-body`
 * (the docs and errors pages tag their `<main>`). Everything else, like the
 * redirects, the 404 and older versions, stays out of the index.
 */
export function pagefindIndex(): AstroIntegration {
  return {
    name: "forms:pagefind",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const site = fileURLToPath(dir);
        const { index, errors } = await pagefind.createIndex({});
        if (!index) throw new Error(`Pagefind: ${errors.join("\n")}`);
        try {
          const added = await index.addDirectory({ path: site });
          if (added.errors.length > 0) throw new Error(`Pagefind: ${added.errors.join("\n")}`);
          const written = await index.writeFiles({ outputPath: join(site, "pagefind") });
          if (written.errors.length > 0) throw new Error(`Pagefind: ${written.errors.join("\n")}`);
          logger.info(`Indexed ${added.page_count} pages into ${written.outputPath}`);
        } finally {
          await pagefind.close();
        }
      },
    },
  };
}
