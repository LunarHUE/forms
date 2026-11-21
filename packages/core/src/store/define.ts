import type {
  PartContext,
  PartHooks,
  PluginContext,
  PluginFactory,
  PluginHooks,
  RequiredPlugins,
  Requirements,
} from "../plugin.js";
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
 * What `definePlugin` takes. `O` is the options the factory passes to
 * `setup` and `initialValue`, and `C` the config of a part. A plugin that
 * keeps meta gives the meta's starting value too.
 */
export type PluginDefinition<A, N extends string, M, F, S extends StandardSchemaV1, R extends Requirements, O, C> = {
  /** Unique among a store's plugins that have hooks. It names the meta slot, the write cause, the API's key and the plugin a part belongs to. */
  readonly name: N;
  /** The plugins this one needs, as `() => [dirty, rebase]`. See `Plugin`. */
  readonly requires?: () => R;
  /**
   * Runs once per store and returns the plugin's hooks. It gets the options
   * the factory was called with: type them on this parameter, and the
   * factory takes them. See `Plugin`.
   */
  setup?(this: void, ctx: PluginContext<M, F, RequiredPlugins<R>>, options: O): PluginHooks<A>;
  /**
   * Runs once per path a part of this plugin attaches at and returns the
   * hooks there. It gets the part's config: type it on this parameter, and
   * the factory's `part` takes it. See `Plugin`.
   */
  part?(this: void, ctx: PartContext<M, F, RequiredPlugins<R>>, config: C): PartHooks;
  /** Gives the form's starting value, with the factory's options. See `Plugin`. */
  initialValue?(this: void, value: unknown, options: O): unknown;
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
 * Makes a plugin factory that carries only the host code in `code`, for the
 * built-in plugins. Each passes what it uses: `createTiming` for a
 * `deferred` or `idle` `onWrite`, `createParts` for `part`, `listParts`
 * for `ctx.parts`. `definePlugin` passes all three.
 */
export function defineWith<
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
  code?: HostCode,
): PluginFactory<NoInfer<A>, NoInfer<N>, NoInfer<M>, NoInfer<F>, NoInfer<S>, RequiredPlugins<R>, NoInfer<O>, NoInfer<C>> {
  const { name, initialMeta, initialFormMeta, setup, initialValue } = definition;
  // The host writes each plugin's meta under its name, with the type its context took.
  const reader = (start: unknown) => (source: { readonly meta?: Readonly<Record<string, unknown>> | undefined }) => source.meta?.[name] ?? start;
  const factory = (options: O) => ({
    ...definition,
    ...code,
    "~host": createPluginHost,
    setup: setup && ((ctx: never) => setup(ctx, options)),
    initialValue: initialValue && ((value: unknown) => initialValue(value, options)),
  });
  // The readers are there for every plugin. `PluginFactory` types them only where the plugin keeps meta.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Object.assign(factory, { part: (config: C) => ({ plugin: name, config }), meta: reader(initialMeta), formMeta: reader(initialFormMeta) }) as never;
}
