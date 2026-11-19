import type { Plugin, PluginContext, PluginHooks, RequiredPlugins, Requirements } from "../plugin.js";
import type { SchemaAdapter } from "../schema-adapter.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import type { CreateParts, ListParts } from "./parts.js";
import { createPluginHost } from "./plugins.js";
import type { CreateTiming } from "./timing.js";

/** The optional host code a plugin carries: the `deferred` and `idle` timings, attaching parts and listing them. */
export interface HostCode {
  readonly "~timing"?: CreateTiming;
  readonly "~parts"?: CreateParts;
  readonly "~list"?: ListParts;
}

/**
 * What `definePlugin` takes. Its members are `Plugin`'s, and a plugin that
 * keeps meta gives the meta's starting value too.
 */
export type PluginDefinition<A, N extends string, M, F, S extends StandardSchemaV1, R extends Requirements = []> = {
  /** Unique among a store's plugins that have hooks. It names the meta slot, the write cause, the API's key and the plugin a part attaches. */
  readonly name: N;
  /** The plugins this one runs after, by name. A name that isn't installed is ignored. */
  readonly after?: readonly string[];
  /** The plugins this one needs, as `() => [dirty, rebase]`. See `Plugin`. */
  readonly requires?: () => R;
  /** Runs once per store and returns the plugin's hooks. See `Plugin`. */
  setup?(ctx: PluginContext<M, F, RequiredPlugins<R>>): PluginHooks<A>;
  /** Runs once per path a part of this plugin attaches at and returns the hooks there. See `Plugin`. */
  attach?(ctx: PluginContext<M, F, RequiredPlugins<R>>, config: never): PluginHooks<never>;
  /** Gives the form's starting value. See `Plugin`. */
  initial?(value: unknown): unknown;
  /** A schema adapter for the schemas of one library. See `Plugin`. */
  readonly schema?: SchemaAdapter<S>;
  /**
   * The plugin's meta on a field before it sets any there. The `meta`
   * reader returns it until then, on the server and in the browser alike.
   * Every field shares it, so a frozen object keeps a selector that returns
   * it stable. Required when the plugin keeps field meta.
   */
  readonly initialMeta?: M;
  /** The plugin's form meta before it sets any. The `formMeta` reader returns it until then. Required when the plugin keeps form meta. */
  readonly initialFormMeta?: F;
} & ([M] extends [never] ? unknown : { readonly initialMeta: M }) &
  ([F] extends [never] ? unknown : { readonly initialFormMeta: F });

/**
 * Makes a plugin that carries only the host code in `code`, for the
 * built-in plugins. Each passes what it uses: `createTiming` for a
 * `deferred` or `idle` `onWrite`, `createParts` for `attach`, `listParts`
 * for `ctx.attachments`. `definePlugin` passes all three.
 */
export function defineHooks<
  A = undefined,
  N extends string = string,
  M = never,
  F = never,
  S extends StandardSchemaV1 = never,
  const R extends Requirements = [],
>(definition: PluginDefinition<A, N, M, F, S, R>, code?: HostCode): Plugin<NoInfer<A>, NoInfer<N>, NoInfer<M>, NoInfer<F>, NoInfer<S>, RequiredPlugins<R>> {
  const { name, initialMeta, initialFormMeta } = definition;
  // The host writes each plugin's meta under its name, with the type its context took.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const reader = (start: unknown) => (source: { readonly meta?: Readonly<Record<string, unknown>> | undefined }) => (source.meta?.[name] ?? start) as never;
  // The readers are there for every plugin. `Plugin` types them only where the plugin keeps meta.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return { ...definition, ...code, "~host": createPluginHost, meta: reader(initialMeta), formMeta: reader(initialFormMeta) } as never;
}
