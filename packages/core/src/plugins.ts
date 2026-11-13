import type { HookPlugin, MetaSource, PluginDefinition } from "./plugin.js";
import { createPluginHost, hosts } from "./store/plugins.js";

export { refuse } from "./store/plugins.js";

/**
 * Makes a hook plugin from its definition. Install it with
 * `createFormsCore({ plugins })` or a definition's `plugins`. The plugin
 * carries the code that runs plugins, so a store without hook plugins never
 * loads it.
 *
 * Its meta types come from `setup`'s parameter. Annotate it as
 * `PluginContext<M, F>`, where `M` is its meta on a field and `F` its meta
 * on the form, and the plugin's `meta` and `formMeta` readers return them.
 */
export function definePlugin<A = undefined, N extends string = string, M = unknown, F = unknown>(
  definition: PluginDefinition<A, N, M, F>,
): HookPlugin<A, N, M, F> {
  const { name } = definition;
  // The host writes each plugin's meta under its name, with the type its context took.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const read = (source: MetaSource) => source.meta?.[name] as (M & F) | undefined;
  return { ...definition, "~host": createPluginHost, meta: read, formMeta: read };
}

/**
 * Delivers the waiting `deferred` and `idle` plugin records of `store` now.
 * For tests, and for code that can't wait for a later task.
 */
export function flushPlugins(store: object): void {
  hosts.get(store)?.flush();
}
