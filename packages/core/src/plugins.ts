import { hookPlugin } from "./hook-plugin.js";
import type { HookPlugin, PluginDefinition } from "./plugin.js";
import { active } from "./store/host/active.js";
import { order } from "./store/host/order.js";
import { recorder } from "./store/host/recorder.js";
import { submit } from "./store/host/submit.js";
import { timing } from "./store/host/timing.js";
import { transforms } from "./store/host/transforms.js";
import { hosts } from "./store/plugins.js";

export { refuse } from "./store/plugins.js";

// Every part, since a plugin's hooks aren't known until its setup runs.
const every = [order, transforms, recorder, timing, active, submit];

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
  return hookPlugin(every, definition);
}

/**
 * Delivers the waiting `deferred` and `idle` plugin records of `store` now.
 * For tests, and for code that can't wait for a later task.
 */
export function flushPlugins(store: object): void {
  hosts.get(store)?.flush();
}
