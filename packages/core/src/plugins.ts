import type { Plugin, RequiredPlugins, Requirements } from "./plugin.js";
import type { StandardSchemaV1 } from "./standard-schema.js";
import { defineHooks, type PluginDefinition } from "./store/define.js";
import { hosts } from "./store/hosts.js";
import { createTiming } from "./store/timing.js";

export { refuse } from "./store/plugins.js";

/**
 * Makes a plugin from its definition. Install it with
 * `createFormsCore({ plugins })` or a definition's `plugins`. The plugin
 * carries the code that runs plugin hooks and delivers `deferred` and
 * `idle` records. `dirty()` and the schema plugins are built without it, so
 * an app that installs only those doesn't bundle it.
 *
 * A plugin keeps meta when it gives a starting value: `initialMeta` for its
 * meta on a field, `initialFormMeta` for its meta on the form. The meta
 * types are the types of those values, or name them by annotating `setup`'s
 * parameter as `PluginContext<M, F>`. The plugin then has a `meta` or
 * `formMeta` reader, which returns the starting value until the plugin sets
 * another. Without a starting value it has no reader and can't set meta.
 *
 * Give `attach` for hooks at the paths the plugin's parts attach at, as
 * `mask` does for each masked field. Give `requires` for the plugins it
 * needs. Give `schema` to make a schema plugin, which gives one library's
 * schemas their default values. Validation needs no plugin.
 */
export function definePlugin<
  A = undefined,
  N extends string = string,
  M = never,
  F = never,
  S extends StandardSchemaV1 = never,
  const R extends Requirements = [],
>(
  definition: PluginDefinition<A, N, M, F, S, R>,
  // NoInfer: a `plugins` list's element type must not pick the meta types, only the definition.
): Plugin<NoInfer<A>, NoInfer<N>, NoInfer<M>, NoInfer<F>, NoInfer<S>, RequiredPlugins<R>> {
  return Object.assign(defineHooks(definition), { "~timing": createTiming });
}

/**
 * Delivers the waiting `deferred` and `idle` plugin records of `store` now.
 * For tests, and for code that can't wait for a later task.
 */
export function flushPlugins(store: object): void {
  hosts.get(store)?.flush();
}
