import type { Flags } from "../definition.js";
import type { FormError, Show } from "../errors.js";
import type { FieldHandle, ResetOptions } from "../handle.js";
import type { Path } from "../path.js";
import type { AnyHookPlugin, AnyPlugin, PluginErrorHandler } from "../plugin.js";
import type { FormStore } from "../store.js";
import { type Baseline, type BaselineOptions, createBaseline } from "./baseline.js";
import type { FormContext } from "./context.js";
import { createStoreCore, type StoreCore } from "./core.js";
import { createHandles } from "./handles.js";
import { noValidation, type Validation, type ValidationOptions } from "./runner.js";
import { createSubmit, type Submit, type SubmitOptions } from "./submit.js";

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
   * The plugins, shared ones first. The hook plugins get a host, and the
   * first plugin that brings the validation runner gives the store its
   * validation.
   */
  readonly plugins?: readonly AnyPlugin[] | undefined;
  /** Called when a plugin hook throws. Defaults to throwing on a later task. */
  readonly onPluginError?: PluginErrorHandler | undefined;
}

/** A form store with the parts it is made of, for tests and internal callers. */
export interface FormInternals<V, E, I, R> {
  readonly store: FormStore<V, E, I, R>;
  readonly core: StoreCore<E, I, R>;
  readonly baseline: Baseline;
  readonly validation: Validation<E>;
  readonly submit: Submit<E, I, R>;
}

/** Makes a form store and returns it with its value store. */
export function createFormInternals<V, E = FormError, I = undefined, R = unknown, O = V>(
  options: FormStoreOptions<V, E, I, R, O>,
): FormInternals<V, E, I, R> {
  // The core reads its own options: id, initial, disabled, readOnly and show.
  const raw = createStoreCore<E, I, R>({
    ...options,
    // The core first calls this when something reads, after `baseline` below exists.
    dirty: (path, value) => baseline.dirty(path, value),
  });
  // Only a store with hook plugins gets a host, and only a store with a plugin
  // that brings the runner gets validation. The plugins bring that code with
  // them, so core neither carries nor runs it for a store without.
  const plugins = options.plugins ?? [];
  const hooked = plugins.filter((plugin): plugin is AnyHookPlugin => plugin.setup !== undefined);
  const host = hooked[0]?.host(raw, hooked, options.onPluginError);
  // Each copy of core has its own host and its own `refuse`, so plugins from
  // two copies don't work together. Development only: production drops it.
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production" && hooked.some((plugin) => plugin.host !== hooked[0]?.host)) {
    console.warn("This store's plugins come from two copies of @lunarhue/forms-core. Install one copy.");
  }
  const runner = plugins.find((plugin) => plugin.validation)?.validation ?? noValidation;
  // The host's core wraps this store's and keeps its types.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const core = (host?.core ?? raw) as StoreCore<E, I, R>;
  const context: FormContext<V, E, I, R> = { core, store: () => store };
  const baseline = createBaseline(context, options);
  const validation = runner(context, options);
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

  const store: FormStore<V, E, I, R> = {
    id: core.id,
    get root() {
      // The runtime handle has every member, and the value type is the caller's.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return handles.root() as FieldHandle<V, E>;
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
    changes: baseline.changes,
    firstInvalid: submit.firstInvalid,
    disabledInvalid: submit.disabledInvalid,
    plugins: host?.apis ?? {},
  };
  host?.start(store, baseline);
  return { store, core, baseline, validation, submit };
}

/** Makes a form store. `define(...).createStore(...)` calls this. */
export function createFormStore<V, E = FormError, I = undefined, R = unknown, O = V>(
  options: FormStoreOptions<V, E, I, R, O>,
): FormStore<V, E, I, R> {
  return createFormInternals(options).store;
}
