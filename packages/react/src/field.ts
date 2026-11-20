import type {
  ErrorOf,
  Validator,
  FieldSnapshot,
  FormSnapshot,
  FormStore,
  HandleTypes,
  Path,
  PluginsOf,
  ValidatorInput,
  ValueOf,
} from "@lunarhue/forms-core";
import { useEffect, useRef } from "react";
import { useSelected } from "./select.js";
import { fieldSource, formSource, storeOf } from "./sources.js";

/**
 * What the hooks need from a handle: its id, its stable path, and a store to
 * subscribe to. Every core handle fits. Hooks read the value and error types
 * from `~types`, so a handle passed as a prop needs no annotation.
 */
export interface HandleLike {
  /** The handle's id. */
  readonly id: string;
  /** The handle's stable path. */
  readonly path: Path;
  /** The store to subscribe to. */
  readonly store: Pick<FormStore<unknown, unknown>, "subscribe" | "getSnapshot" | "getServerSnapshot">;
  /** Type information only. */
  readonly "~types"?: HandleTypes<unknown, unknown>;
}

/** The snapshot type of a handle type. It has `dirty` when the handle's form has `dirty()`. */
export type SnapshotOf<H> = FieldSnapshot<ValueOf<H>, ErrorOf<H>, PluginsOf<H>>;

/**
 * Compares two selected values. Return true to keep the previous one and
 * skip the re-render. Defaults to `Object.is`.
 */
export type IsEqual<T> = (previous: T, next: T) => boolean;

/** Selects the whole snapshot. */
export const whole = <S>(snapshot: S): S => snapshot;

/**
 * Reads a field's snapshot and re-renders when it changes. It reads through
 * `useSyncExternalStore` on the handle's store, with the store's server
 * snapshot for server rendering and hydration.
 *
 * With `select`, the component gets what `select` returns and re-renders only
 * when that changes by `isEqual`. `select` may be an inline function. It must
 * return the same value, by `isEqual`, for the same snapshot.
 */
export const useField: {
  <H extends HandleLike>(handle: H): SnapshotOf<H>;
  <H extends HandleLike, T>(handle: H, select: (snapshot: SnapshotOf<H>) => T, isEqual?: IsEqual<T>): T;
} = <H extends HandleLike, T>(
  handle: H,
  select?: (snapshot: SnapshotOf<H>) => T,
  isEqual?: IsEqual<T>,
) => {
  // Snapshots of `handle` are its value and error types, which `~types` records.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const pick = (select ?? whole) as (snapshot: FieldSnapshot<unknown, unknown>) => T;
  return useSelected(fieldSource(handle), pick, isEqual);
};

/** What `useFormState` needs from a store. Every `FormStore` fits. `Installed` is the names of its plugins. */
export type FormStateSource<I, R, Installed extends string = never> = Pick<
  FormStore<unknown, never, I, R, {}, Installed>,
  "subscribeForm" | "getFormSnapshot" | "getServerFormSnapshot"
>;

/**
 * Reads the form snapshot and re-renders when it changes. Takes the value
 * `useForm` returned, or any store, such as `handle.store`. With `select` it
 * narrows the same way `useField` does.
 */
export const useFormState: {
  <I, R, Installed extends string = never>(
    form: FormStateSource<I, R, Installed> | { readonly store: FormStateSource<I, R, Installed> },
  ): FormSnapshot<I, R, Installed>;
  <I, R, T, Installed extends string = never>(
    form: FormStateSource<I, R, Installed> | { readonly store: FormStateSource<I, R, Installed> },
    select: (snapshot: FormSnapshot<I, R, Installed>) => T,
    isEqual?: IsEqual<T>,
  ): T;
} = <I, R, T>(
  form: FormStateSource<I, R> | { readonly store: FormStateSource<I, R> },
  select?: (snapshot: FormSnapshot<I, R>) => T,
  isEqual?: IsEqual<T>,
) => {
  // The store's form snapshots carry its own intent and result types.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const pick = (select ?? whole) as (snapshot: FormSnapshot<unknown>) => T;
  return useSelected(formSource(storeOf(form)), pick, isEqual);
};

/** What `useItems` needs from an array handle. Array handles and loose handles fit. */
export interface ArrayHandleLike extends HandleLike {
  /** Returns the item handle for a stable key. */
  item(key: string): unknown;
}

/** What `useValidator` needs from a handle. */
export interface ValidatorHandleLike extends HandleLike {
  /** Adds a validator and returns the function that removes it. */
  registerValidator(validator: never): () => void;
}

/** A validator input as the runtime reads it. */
type AnyValidatorInput = ValidatorInput<unknown, unknown> | undefined | null | false;

/** What `debounced`, `validateOn` and `recheckOnSubmit` put on the function they return. */
interface Tags {
  readonly "~on"?: unknown;
  readonly "~recheck"?: unknown;
  readonly "~schema"?: unknown;
}

/** The function a validator input gives. Undefined for a schema or none. */
function functionOf(input: AnyValidatorInput): Validator<unknown, unknown> | undefined {
  // A schema that is also a function, as some libraries make them, counts as a schema.
  return typeof input === "function" && !("~standard" in input) ? input : undefined;
}

/**
 * Adds a validator to a field while the component is mounted, and removes it
 * and its errors on unmount. Pass `undefined`, `null` or `false` to add none,
 * so a validator can be conditional without breaking the rules of hooks.
 *
 * A validator may be inline, wrapped or not. The adapter registers once and
 * calls the latest function on each run. It registers again when the handle
 * changes, when a schema is a different object, when a function becomes a
 * schema or the other way round, or when `validateOn` or `recheckOnSubmit`
 * change. A wrapped schema is a function, so writing
 * `debounced(schema, 300)` inline doesn't register again on each render.
 */
export const useValidator: <H extends ValidatorHandleLike>(
  handle: H,
  validator: ValidatorInput<ValueOf<H>, ErrorOf<H>> | undefined | null | false,
) => void = (handle, validator) => {
  // The validator was checked against the handle's types, which the runtime doesn't need.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const input = validator as AnyValidatorInput;
  const latest = useRef(input);
  useEffect(() => {
    latest.current = input;
  });

  // What decides whether to register again. A function may be new on every
  // render, so only its tags count.
  const fn = functionOf(input);
  const isFunction = fn !== undefined;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const tags = (fn ?? {}) as Tags;
  const schema = isFunction ? undefined : input || undefined;
  const on = tags["~on"];
  const recheck = tags["~recheck"];
  const schemaResult = tags["~schema"];

  useEffect(() => {
    if (!schema && !isFunction) return undefined;
    // The function to call is the latest one given, read when the run starts.
    const run = (value: unknown, ctx: never) => functionOf(latest.current)?.(value, ctx);
    const check = schema ?? Object.assign(run, { "~on": on, "~recheck": recheck, "~schema": schemaResult });
    // The handle's validator type is its own value type, which `validator` was checked against.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return handle.registerValidator(check as never);
  }, [handle, isFunction, schema, on, recheck, schemaResult]);
};
