import type { Flags } from "../definition.js";
import type { FormError, Show } from "../errors.js";
import type { FieldHandle, ResetOptions } from "../handle.js";
import type { Path } from "../path.js";
import type { AnyPlugin, Part, PluginErrorHandler } from "../plugin.js";
import { problem } from "../problem.js";
import type { FormStore } from "../store.js";
import { type Baseline, type BaselineOptions, createBaseline } from "./baseline.js";
import type { FormContext } from "./context.js";
import { createStoreCore, type StoreCore } from "./core.js";
import { createHandles } from "./handles.js";
import type { Validation, ValidationOptions } from "./runner.js";
import { createSubmit, type Submit, type SubmitOptions } from "./submit.js";
import { createValidation } from "./validation.js";

declare const process: { readonly env: { readonly NODE_ENV?: string } };
declare const console: { warn(message: string): void };

/** What `createFormStore` takes. Each module adds the options it reads to its own options type. */
export interface FormStoreOptions<V, E = FormError, I = undefined, R = unknown, O = V>
  extends BaselineOptions<V>, ValidationOptions<V, E>, SubmitOptions<V, E, I, R, O> {
  /** The store id, which prefixes every handle id. */
  readonly id: string;
  /** The starting value. */
  readonly initial: V;
  /** Fields that start disabled. */
  readonly disabled?: Flags<V> | undefined;
  /** Fields that start read-only. */
  readonly readOnly?: Flags<V> | undefined;
  /** When validation errors show. */
  readonly show?: Show | undefined;
  /** The item `push` and `insert` add when called without one. Gets the array's stable path. Defaults to undefined. */
  readonly itemValue?: ((path: Path) => unknown) | undefined;
  /**
   * The plugins, shared ones first. The hook plugins get a host and
   * `dirty()` gives the store dirty tracking.
   */
  readonly plugins?: readonly AnyPlugin[] | undefined;
  /** Called when a plugin hook throws. Defaults to throwing on a later task. */
  readonly onPluginError?: PluginErrorHandler | undefined;
  /** Parts to attach at the root once the plugins are set up, as `define` takes them after the config. */
  readonly parts?: readonly Part[] | undefined;
}

/**
 * A store as core makes it. It has `changes` and its snapshots have `dirty`
 * with or without `dirty()`, so its shape is the same in every form. The
 * definition's types take them away when the form has no `dirty()`.
 */
// oxlint-disable-next-line typescript/no-empty-object-type
export type MadeStore<V, E, I, R> = FormStore<V, E, I, R, {}, "dirty">;

/** A form store with the parts it is made of, for tests and internal callers. */
export interface FormInternals<V, E, I, R> {
  readonly store: MadeStore<V, E, I, R>;
  readonly core: StoreCore<E, I, R>;
  readonly baseline: Baseline;
  readonly validation: Validation<E>;
  readonly submit: Submit<E, I, R>;
}

/** Makes a form store and returns it with its value store. */
export function createFormInternals<V, E = FormError, I = undefined, R = unknown, O = V>(
  given: FormStoreOptions<V, E, I, R, O>,
): FormInternals<V, E, I, R> {
  const plugins = given.plugins ?? [];
  const parts = given.parts ?? [];
  let initial: unknown = given.initial;
  // Each plugin can replace the starting value, so the last one that does wins.
  for (const plugin of plugins) initial = plugin.initial?.(initial) ?? initial;
  // A plugin's starting value is one the form's value type allows, as a write's is.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const options = { ...given, initial: initial as V };
  // Dirty tracking comes with `dirty()`. Without it the core gets no `dirty`
  // option, so nothing is dirty and nothing is compared.
  const createDirty = plugins.find((plugin) => plugin["~dirty"])?.["~dirty"];
  // Item keys that follow inserts, removes and moves come with `arrays()`.
  const arrays = plugins.find((plugin) => plugin["~arrays"])?.["~arrays"];
  // The core reads its own options: id, initial, disabled, readOnly and show.
  const raw = createStoreCore<E, I, R>({
    ...options,
    // The core first calls this when something reads, after `baseline` below exists.
    dirty: createDirty && ((path, value) => baseline.dirty(path, value)),
    arrays: arrays?.[0],
  });
  // Only a store with hook plugins gets a host. The plugins bring its code
  // with them, so core neither carries nor runs it for a store without.
  const hooked = plugins.filter((plugin) => plugin.setup !== undefined || plugin.attach !== undefined);
  const createHost = hooked[0]?.["~host"];
  const host = createHost?.(raw, plugins, options.onPluginError);
  // A part's plugin is missing. The types catch it, so production doesn't check again.
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production" && !host && parts[0]) {
    throw new Error(problem("plugins:missing", parts[0].plugin));
  }
  // Each copy of core has its own host and its own `refuse`, so plugins from
  // two copies don't work together. Development only: production drops it.
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production" && hooked.some((plugin) => plugin["~host"] !== createHost)) {
    console.warn(problem("plugins:copies"));
  }
  // The host's core wraps this store's and keeps its types.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const core = (host?.core ?? raw) as StoreCore<E, I, R>;
  const context: FormContext<V, E, I, R> = { core, store: () => store };
  const baseline = createBaseline(context, options, createDirty, arrays?.[1]);
  const validation = createValidation(context, options);
  const submit = createSubmit(context, options, validation, host);

  const reset = (path: Path, resetOptions?: ResetOptions) => {
    const run = () =>
      core.batch(() => {
        validation.reset(path);
        if (path.length === 0) submit.abort();
        baseline.reset(path, resetOptions);
      });
    // With plugins, the writes get `cause: "reset"` and `onReset` runs in the same batch.
    if (host) host.reset(path, run);
    else run();
  };

  const handles = createHandles({
    core,
    store: () => store,
    validation,
    reset,
    itemValue: options.itemValue ?? (() => undefined),
  });

  const store: MadeStore<V, E, I, R> = {
    id: core.id,
    get root() {
      // The runtime handle has every member, and the value type is the caller's.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return handles.root() as FieldHandle<V, E, "dirty">;
    },
    subscribe: core.subscribe,
    getSnapshot: core.getSnapshot,
    getServerSnapshot: core.getServerSnapshot,
    subscribeForm: core.subscribeForm,
    getFormSnapshot: core.getFormSnapshot,
    getServerFormSnapshot: core.getServerFormSnapshot,
    peek: core.getFormSnapshot,
    batch: core.batch,
    submit: submit.submit,
    handleSubmit: submit.handleSubmit,
    setErrors: submit.setErrors,
    validate: () => validation.validate([]),
    reset: (resetOptions) => reset([], resetOptions),
    registerValidator: validation.register,
    fieldAt: handles.fieldAt,
    // Without `dirty()` the types have no `changes`. Development throws for callers without types.
    changes:
      typeof process !== "undefined" && process.env.NODE_ENV !== "production" && !createDirty
        ? () => {
            throw new Error(problem("dirty:missing"));
          }
        : baseline.changes,
    firstInvalid: submit.firstInvalid,
    disabledInvalid: submit.disabledInvalid,
    plugins: host?.apis ?? {},
  };
  host?.start(store, baseline, validation, parts);
  return { store, core, baseline, validation, submit };
}

/** Makes a form store. `define(...).createStore(...)` calls this. */
export function createFormStore<V, E = FormError, I = undefined, R = unknown, O = V>(
  options: FormStoreOptions<V, E, I, R, O>,
): MadeStore<V, E, I, R> {
  return createFormInternals(options).store;
}
