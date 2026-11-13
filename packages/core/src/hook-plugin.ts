import type { HookPlugin, MetaSource, PluginDefinition } from "./plugin.js";
import { createPluginHost, type HostPart } from "./store/plugins.js";

/**
 * Makes a hook plugin that brings the host parts in `parts`. Core's own
 * plugins use it to bring only the parts their hooks need: a hook whose
 * part no plugin in the store brings never runs. `definePlugin` brings
 * every part.
 */
export function hookPlugin<A, N extends string, M, F>(parts: readonly HostPart[], definition: PluginDefinition<A, N, M, F>): HookPlugin<A, N, M, F> {
  const { name } = definition;
  // The host writes each plugin's meta under its name, with the type its context took.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const read = (source: MetaSource) => source.meta?.[name] as (M & F) | undefined;
  return { ...definition, "~host": createPluginHost, "~parts": parts, meta: read, formMeta: read };
}
