import type { HookPlugin, MetaSource, PluginDefinition } from "../plugin.js";
import { createPluginHost } from "./plugins.js";

/** What a reader returns where the plugin has set nothing, given the definition's starting value `I`. */
export type Unset<I> = undefined extends I ? undefined : never;

/**
 * Makes a hook plugin without the `deferred` and `idle` timings, for the
 * built-in plugins whose `onWrite` is `sync` or absent. `definePlugin` adds
 * the timings to it.
 */
export function defineHooks<
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
