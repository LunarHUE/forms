import type { NamedSSRLoadedRendererValue } from "astro";
import { createComponent, generateHydrationScript, renderToString } from "@solidjs/web";

let nextId = 0;

const renderer: NamedSSRLoadedRendererValue = {
  name: "forms/solid",
  // Astro asks every renderer in turn. Any function passes a plain typeof
  // check, so claim only hydrated components from the Solid demos folder.
  // Astro sets `componentUrl` only for islands with a client: directive.
  async check(Component, _props, _children, metadata) {
    return typeof Component === "function" && !!metadata?.componentUrl?.includes("/demos/solid/");
  },
  async renderToStaticMarkup(Component, props, slots, metadata) {
    if (Object.keys(slots).length > 0) {
      throw new Error("The local Solid 2 renderer supports props only; Astro slots are not wired up.");
    }
    const renderId = `solid-${nextId++}-`;
    return {
      attrs: { "data-solid-render-id": renderId },
      html: renderToString(() => createComponent(Component, props), {
        renderId,
        noScripts: !metadata?.hydrate,
      }),
    };
  },
  renderHydrationScript: () => generateHydrationScript(),
};

export default renderer;
