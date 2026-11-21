import type { DefinedValue, Definition, WithPlugins } from "../definition.js";
import type { FormError } from "../errors.js";
import { createFormsCore } from "../forms-core.js";
import type { Path } from "../path.js";
import type { NamedParts, PluginApis, PluginNames, Plugins, When, WriteRecord } from "../plugin.js";
import { definePlugin, flushPlugins } from "../plugins.js";
import type { FieldSnapshot, FormSnapshot } from "../snapshot.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import type { FormStore } from "../store.js";
import { isPlainObject } from "../store/tree.js";

/** A throw or a rejection from a plugin hook, as `onPluginError` got it. */
export interface PluginFailure {
  /** The name of the plugin whose hook threw. */
  readonly plugin: string;
  readonly error: unknown;
}

/** What the server renders from a store: the form snapshot and each field's, by the field's dotted name. */
export interface ServerState<I = undefined, R = unknown, N extends string = never> {
  readonly form: FormSnapshot<I, R, N>;
  /** Every field of the starting value, the root under `""`. An array item is under its index, as `rows.0.title`. */
  readonly fields: Readonly<Record<string, FieldSnapshot<unknown, FormError, N>>>;
}

/** What `testStore` returns. `A` is the plugins' APIs and `N` their names, as on `FormStore`. */
// The default is an object type with no keys, as on `FormStore`.
// oxlint-disable-next-line typescript/no-empty-object-type
export interface TestStore<V, I = undefined, R = unknown, A = {}, N extends string = never> {
  /** The store, typed as an app's store of the same definition is. */
  readonly store: FormStore<V, FormError, I, R, A, N>;
  /**
   * The write records each timing has delivered so far, in order. A `sync`
   * record is here when the batch ends. A `deferred` one is here after a
   * microtask or `flush`, and an `idle` one after `flush`. Empty a list with
   * `records.sync.length = 0`.
   */
  readonly records: Readonly<Record<When, WriteRecord[]>>;
  /** What plugin hooks threw, in order. Nothing is rethrown, so check it is empty. */
  readonly errors: PluginFailure[];
  /** Delivers the waiting `deferred` and `idle` records now, as `ctx.flush` does. */
  flush(this: void): void;
  /** Gives the store a listener, which runs `onActive`. Call what it returns to remove it, which runs the cleanup. */
  listen(this: void): () => void;
  /** Reads the server snapshots of the form and of every field in the starting value. */
  server(this: void): ServerState<I, R, N>;
}

/** The config `testStore` takes: a definition with its `plugins`, as `define` takes it. */
export type TestStoreConfig<V, S extends StandardSchemaV1, I, R, D extends Plugins> = WithPlugins<
  Definition<V, S, D, FormError, I, R>,
  D,
  NoInfer<DefinedValue<V, S, D>>
>;

const timings: readonly When[] = ["sync", "deferred", "idle"];

/**
 * Makes a store for testing a plugin, with no framework. It takes a form
 * definition with the plugins to test in its `plugins`, as `define` does, and
 * types the store the same way, so `store.plugins` has each plugin's API.
 *
 * Parts after the config attach at the root when the store is made, as
 * `define` takes them.
 *
 * Three recording plugins run after the given ones, one at each timing, to
 * fill `records`. Plugin errors go to `errors`. No timer is needed: `flush`
 * delivers what waits, and an `idle` delivery never comes before it unless
 * the test waits for a timer.
 */
export function testStore<V = never, S extends StandardSchemaV1 = never, I = undefined, R = unknown, const D extends Plugins = []>(
  config: TestStoreConfig<V, S, I, R, D>,
  ...parts: readonly NamedParts<PluginNames<D>, NoInfer<DefinedValue<V, S, D>>>[]
): TestStore<DefinedValue<V, S, D>, I, R, PluginApis<D>, PluginNames<D>> {
  type Store = TestStore<DefinedValue<V, S, D>, I, R, PluginApis<D>, PluginNames<D>>["store"];
  const errors: PluginFailure[] = [];
  const records: Record<When, WriteRecord[]> = { sync: [], deferred: [], idle: [] };
  const recorders = timings.map((when) =>
    definePlugin({ name: `testStore:${when}`, setup: () => ({ when, onWrite: (list) => void records[when].push(...list) }) })(),
  );
  const forms = createFormsCore({ onPluginError: (error, plugin) => void errors.push({ plugin, error }) });
  // The parameter's type checked the config against `D`, and the recorders add no API,
  // so the store has the type an app's store of this definition has.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const store = forms.define({ ...config, plugins: [...(config.plugins ?? []), ...recorders] } as never, ...(parts as never[])).createStore() as unknown as Store;

  const server = (): ServerState<I, R, PluginNames<D>> => {
    const fields: Record<string, FieldSnapshot<unknown, FormError, PluginNames<D>>> = {};
    const visit = (path: Path) => {
      const snapshot = store.getServerSnapshot(path);
      fields[snapshot.name] = snapshot;
      const { value } = snapshot;
      if (Array.isArray(value)) for (const key of snapshot.keys ?? []) visit([...path, key]);
      else if (isPlainObject(value)) for (const key of Object.keys(value)) visit([...path, key]);
    };
    visit([]);
    return { form: store.getServerFormSnapshot(), fields };
  };

  return {
    store,
    records,
    errors,
    flush: () => flushPlugins(store),
    listen: () => store.subscribeForm(() => {}),
    server,
  };
}
