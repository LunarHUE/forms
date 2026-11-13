import type { Plugin, PluginDefinition } from "./plugin.js";
import { partsOf } from "./store/baseline/registry.js";
import { createPluginHost } from "./store/plugins.js";

export { refuse } from "./store/plugins.js";

/**
 * Makes a plugin from its definition. Install it with
 * `createFormsCore({ plugins })` or a definition's `plugins`. The plugin
 * carries the code that runs plugins, so a store without plugins never
 * loads it.
 */
export function definePlugin<A = undefined, N extends string = string>(definition: PluginDefinition<A, N>): Plugin<A, N> {
  return { ...definition, host: createPluginHost };
}

/**
 * The `api` that `plugin`'s setup returned in `store`, typed from the plugin.
 * Undefined when the plugin isn't installed there.
 */
// `any` lets a plugin of any name fit.
// oxlint-disable-next-line typescript/no-explicit-any
export function pluginApi<A>(store: object, plugin: Plugin<A, any>): A | undefined {
  // The host keeps each plugin's api with the plugin, so it has the plugin's type.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return partsOf(store)?.host?.api(plugin) as A | undefined;
}

/**
 * Delivers the waiting `deferred` and `idle` plugin records of `store` now.
 * For tests, and for code that can't wait for a later task.
 */
export function flushPlugins(store: object): void {
  partsOf(store)?.host?.flush();
}
