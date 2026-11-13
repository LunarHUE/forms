import { defaultClientConditions, defaultServerConditions, type PluginOption, type UserConfig } from "vite";

// Workspace packages export their source under this condition, so the apps
// build the library from source and need no package build first.
const sourceCondition = "@lunarhue/source";

/**
 * The Vite config both apps share. `vite build` makes the client bundle,
 * with its entry at a fixed name the shared server links to, and
 * `vite build --ssr src/entry-server.tsx` makes the server entry the shared
 * server imports. Only the framework's plugins differ.
 */
export function appConfig(plugins: PluginOption[], ssrBuild: boolean): UserConfig {
  return {
    plugins,
    resolve: { conditions: [sourceCondition, ...defaultClientConditions] },
    ssr: { resolve: { conditions: [sourceCondition, ...defaultServerConditions] } },
    build: ssrBuild
      ? { outDir: "dist/server", emptyOutDir: true }
      : {
          outDir: "dist/client",
          emptyOutDir: true,
          rolldownOptions: {
            input: "src/entry-client.tsx",
            output: { entryFileNames: "assets/client.js" },
          },
        },
  };
}
