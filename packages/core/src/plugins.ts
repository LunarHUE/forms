import type { PluginFactory, RequiredPlugins, Requirements } from "./plugin.js";
import type { StandardSchemaV1 } from "./standard-schema.js";
import { defineWith, type PluginDefinition } from "./store/define.js";
import { hosts } from "./store/hosts.js";
import { createTiming } from "./store/timing.js";

export { refuse } from "./store/plugins.js";

/**
 * Makes a plugin factory from its definition. Call the factory for the
 * plugin and install it with `createFormsCore({ plugins })` or a
 * definition's `plugins`: `definePlugin({ name: "autosave", setup })` gives
 * `autosave`, installed as `autosave({ wait: 800 })`. The options are what
 * `setup` takes after its context, so a plugin whose `setup` takes none is
 * installed as `autosave()`.
 *
 * The plugin carries the code that runs plugin hooks and delivers
 * `deferred` and `idle` records. `dirty()` and the schema plugins are built
 * without it, so an app that installs only those doesn't bundle it. The
 * code that attaches parts comes with `part`, so a plugin with only `setup`
 * doesn't bring it.
 *
 * A plugin keeps meta when it gives a starting value: `initialMeta` for its
 * meta on a field, `initialFormMeta` for its meta on the form. The meta
 * types are the types of those values, or name them by annotating `setup`'s
 * parameter as `PluginContext<M, F>`. The factory then has a `meta` or
 * `formMeta` reader, which returns the starting value until the plugin sets
 * another. Without a starting value it has no reader and can't set meta.
 *
 * Give `part` for hooks at the paths the plugin's parts attach at, and make
 * the parts with `part(plugin, config)`, typed by the config the hook
 * takes: `part(limit, 10)`. Give `requires` for the plugins it needs, as
 * factories: `requires: () => [dirty]`. Its context's store then has what
 * they add, such as `changes()`. Give `schema` to make a schema plugin,
 * which gives one library's schemas their default values. Validation needs
 * no plugin.
 */
export function definePlugin<
  const N extends string,
  A = undefined,
  M = never,
  F = never,
  S extends StandardSchemaV1 = never,
  const R extends Requirements = [],
  O = void,
  C = void,
>(
  definition: PluginDefinition<A, N, M, F, S, R, O, C>,
  // NoInfer: a `plugins` list's element type must not pick the meta types, only the definition.
): PluginFactory<NoInfer<A>, NoInfer<N>, NoInfer<M>, NoInfer<F>, NoInfer<S>, RequiredPlugins<R>, NoInfer<O>, NoInfer<C>> {
  return defineWith(definition, { "~timing": createTiming });
}

/**
 * Delivers the waiting `deferred` and `idle` plugin records of `store` now.
 * For tests, and for code that can't wait for a later task.
 */
export function flushPlugins(store: object): void {
  hosts.get(store)?.flush();
}
