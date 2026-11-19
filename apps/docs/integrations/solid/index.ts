import solid from "@solidjs/vite-plugin";
import type { AstroIntegration } from "astro";

const name = "forms/solid";

export interface SolidOptions {
  // Files the Solid compiler transforms. Keep it narrow: React islands are
  // also .tsx, and Solid's compiler would break them.
  readonly include: string[];
}

// @astrojs/solid-js 7.x targets Solid 1. This is a local Solid 2 renderer,
// copied from Xenon's docs, until @astrojs/solid-js 8 is published.
export default function solidIntegration({ include }: SolidOptions): AstroIntegration {
  return {
    name,
    hooks: {
      "astro:config:setup": ({ addRenderer, updateConfig }) => {
        addRenderer({
          name,
          clientEntrypoint: new URL("./client.ts", import.meta.url).pathname,
          serverEntrypoint: new URL("./server.ts", import.meta.url).pathname,
        });
        updateConfig({
          vite: { plugins: [solid({ ssr: true, include })] },
        });
      },
    },
  };
}
