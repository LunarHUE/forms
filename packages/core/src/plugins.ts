import type { HookPlugin, PluginDefinition, SchemaPlugin } from "./plugin.js";
import type { SchemaAdapter } from "./schema-adapter.js";
import type { StandardSchemaV1 } from "./standard-schema.js";
import { defineHooks, type Unset } from "./store/define.js";
import { hosts } from "./store/plugins.js";
import { createTiming } from "./store/timing.js";

export { refuse } from "./store/plugins.js";

/**
 * Makes a hook plugin from its definition. Install it with
 * `createFormsCore({ plugins })` or a definition's `plugins`. The plugin
 * carries the code that runs plugins and delivers `deferred` and `idle`
 * records, so a store without hook plugins never loads it.
 *
 * Its meta types come from `setup`'s parameter. Annotate it as
 * `PluginContext<M, F>`, where `M` is its meta on a field and `F` its meta
 * on the form, and the plugin's `meta` and `formMeta` readers return them.
 * Give `initialMeta` and `meta` never returns undefined. Give
 * `initialFormMeta` and `formMeta` never does either.
 */
export function definePlugin<
  A = undefined,
  N extends string = string,
  M = unknown,
  F = unknown,
  MI extends M | undefined = undefined,
  FI extends F | undefined = undefined,
>(
  definition: PluginDefinition<A, N, M, F> & { readonly initialMeta?: MI; readonly initialFormMeta?: FI },
): HookPlugin<A, N, M, F, Unset<MI>, Unset<FI>> {
  return { ...defineHooks(definition), "~timing": createTiming };
}

/**
 * Makes a schema plugin from a schema adapter. Its name is the adapter's
 * vendor. Validation needs no plugin, so the plugin only gives its
 * library's schemas their default values.
 */
export function defineSchemaPlugin<S extends StandardSchemaV1>(adapter: SchemaAdapter<S>): SchemaPlugin<S> {
  return { name: adapter.vendor, schema: adapter };
}

/**
 * Delivers the waiting `deferred` and `idle` plugin records of `store` now.
 * For tests, and for code that can't wait for a later task.
 */
export function flushPlugins(store: object): void {
  hosts.get(store)?.flush();
}
