import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { appConfig, notSolid, pinFramework } from "../../vite.base.ts";

// The adapter's `./v1` build, which is its source under this condition.
const solid1 = "@lunarhue/solid1";

// Solid 1's web module is `solid-js/web`, where the shared pages import
// Solid 2's `@solidjs/web`. `ssr: true` compiles hydratable DOM code for the
// client and SSR code for the server.
export default defineConfig(({ isSsrBuild }) => {
  const config = appConfig(
    [
      pinFramework(["solid-js"], { "@solidjs/web": "solid-js/web", "@lunarhue/forms-solid": "@lunarhue/forms-solid/v1" }),
      solid({ ssr: true, exclude: notSolid }),
    ],
    isSsrBuild === true,
  );
  return {
    ...config,
    resolve: { ...config.resolve, conditions: [solid1, ...(config.resolve?.conditions ?? [])] },
    ssr: { ...config.ssr, resolve: { ...config.ssr?.resolve, conditions: [solid1, ...(config.ssr?.resolve?.conditions ?? [])] } },
  };
});
