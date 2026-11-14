import type { HookPlugin, MetaSource, PluginDefinition } from "./plugin.js";
import { createPluginHost, hosts } from "./store/plugins.js";

export { refuse } from "./store/plugins.js";

/** What a reader returns where the plugin has set nothing, given the definition's starting value `I`. */
type Unset<I> = undefined extends I ? undefined : never;

/**
 * Makes a hook plugin from its definition. Install it with
 * `createFormsCore({ plugins })` or a definition's `plugins`. The plugin
 * carries the code that runs plugins, so a store without hook plugins never
 * loads it.
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
  const { name } = definition;
  // The host writes each plugin's meta under its name, with the type its context took.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const reader = (start: unknown) => (source: MetaSource) => (source.meta?.[name] ?? start) as never;
  return { ...definition, "~host": createPluginHost, meta: reader(definition.initialMeta), formMeta: reader(definition.initialFormMeta) };
}

/**
 * Delivers the waiting `deferred` and `idle` plugin records of `store` now.
 * For tests, and for code that can't wait for a later task.
 */
export function flushPlugins(store: object): void {
  hosts.get(store)?.flush();
}
