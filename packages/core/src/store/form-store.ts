import type { Flags } from "../definition.js";
import type { FormError, Show } from "../errors.js";
import type { FieldHandle, ResetOptions } from "../handle.js";
import type { Path } from "../path.js";
import type { FormStore } from "../store.js";
import { type Baseline, type BaselineOptions, createBaseline } from "./baseline.js";
import type { FormContext } from "./context.js";
import { createStoreCore, type StoreCore } from "./core.js";
import { createHandles } from "./handles.js";
import { createSubmit, type Submit, type SubmitOptions } from "./submit.js";
import { createValidation, type Validation, type ValidationOptions } from "./validation.js";

/** What `createFormStore` takes. Each module adds the options it reads to its own options type. */
export interface FormStoreOptions<V, E = FormError, I = undefined, R = unknown>
  extends BaselineOptions<V>, ValidationOptions<V, E>, SubmitOptions<V, E, I, R> {
  /** The store id, which prefixes every handle id. */
  readonly id: string;
  /** The starting value. */
  readonly initial: V;
  /** Fields that start disabled. */
  readonly disabled?: Flags<V>;
  /** Fields that start read-only. */
  readonly readOnly?: Flags<V>;
  /** When validation errors show. */
  readonly show?: Show;
  /** The item `push` and `insert` add when called without one. Gets the array's stable path. Defaults to undefined. */
  readonly itemValue?: (path: Path) => unknown;
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
export function createFormInternals<V, E = FormError, I = undefined, R = unknown>(
  options: FormStoreOptions<V, E, I, R>,
): FormInternals<V, E, I, R> {
  const core = createStoreCore<E, I, R>({
    id: options.id,
    initial: options.initial,
    disabled: options.disabled,
    readOnly: options.readOnly,
    ...(options.show === undefined ? {} : { show: options.show }),
    // The core first calls this when something reads, after `baseline` below exists.
    dirty: (path, value) => baseline.dirty(path, value),
  });
  const context: FormContext<V, E, I, R> = { core, store: () => store };
  const baseline = createBaseline(context, options);
  const validation = createValidation(context, options);
  const submit = createSubmit(context, options, validation);

  const reset = (path: Path, resetOptions?: ResetOptions) =>
    core.batch(() => {
      validation.reset(path);
      if (path.length === 0) submit.abort();
      baseline.reset(path, resetOptions);
    });

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
    subscribe: (path, listener) => core.subscribe(path, listener),
    getSnapshot: (path) => core.getSnapshot(path),
    getServerSnapshot: (path) => core.getServerSnapshot(path),
    subscribeForm: (listener) => core.subscribeForm(listener),
    getFormSnapshot: () => core.getFormSnapshot(),
    getServerFormSnapshot: () => core.getServerFormSnapshot(),
    peek: () => core.getFormSnapshot(),
    batch: (fn) => core.batch(fn),
    submit: (...args) => submit.submit(...args),
    handleSubmit: (event) => submit.handleSubmit(event),
    setErrors: (errors) => submit.setErrors(errors),
    validate: () => validation.validate([]),
    reset: (resetOptions) => reset([], resetOptions),
    registerValidator: (path, validator) => validation.register(path, validator),
    fieldAt: (path) => handles.fieldAt(path),
    changes: (path) => baseline.changes(path),
    firstInvalid: () => submit.firstInvalid(),
  };
  return { store, core, baseline, validation, submit };
}

/** Makes a form store. `define(...).createStore(...)` calls this. */
export function createFormStore<V, E = FormError, I = undefined, R = unknown>(
  options: FormStoreOptions<V, E, I, R>,
): FormStore<V, E, I, R> {
  return createFormInternals(options).store;
}
