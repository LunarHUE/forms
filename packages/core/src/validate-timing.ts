import type { StandardSchemaV1 } from "./standard-schema.js";
import { isSchema, type Tags } from "./store/validate/inputs.js";
import type { ValidateTiming, WrappedSchema } from "./validator.js";
import type { PlatformAbortSignal } from "./value.js";

// Core has no DOM or node types, so this declares the platform globals it uses.
declare function setTimeout(run: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;

/** A check as the wrappers call it. */
type AnyCheck = ((value: unknown, ctx: { readonly signal: PlatformAbortSignal }) => unknown) & Tags;

/** The input type of a schema or of a wrapped one. */
type SchemaInput<S> = S extends StandardSchemaV1<infer In, unknown> ? In : S extends WrappedSchema<infer In> ? In : never;

/** A function stays as it is. A schema becomes a function that returns its result. */
const checkOf = (check: object): AnyCheck => {
  if (!isSchema(check)) {
    // The overloads only let functions and schemas in.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return check as AnyCheck;
  }
  const props = check["~standard"];
  return Object.assign((value: unknown) => props.validate(value), { "~schema": true });
};

/** A new function that calls `check`, with the tags `check` had and `tags` on top. */
const tagged = (check: object, tags: Tags): AnyCheck => {
  const inner = checkOf(check);
  return Object.assign((value: unknown, ctx: { readonly signal: PlatformAbortSignal }) => inner(value, ctx), inner, tags);
};

/**
 * Makes a check wait for a pause in input: `debounced(check, 400)` runs
 * `check` once `ms` milliseconds pass with no newer run. The field is
 * `validating` while it waits. A newer run, a reset or removing the validator
 * ends the wait without calling `check`. Submit and `validate()` skip the
 * wait.
 *
 * `check` is a field validator, a form validator, a Standard Schema or any
 * of them already wrapped, and the result goes anywhere `check` does.
 */
export function debounced<V, C extends { readonly signal: PlatformAbortSignal }, R>(
  check: (value: V, ctx: C) => R | Promise<R>,
  ms: number,
): (value: V, ctx: C) => Promise<R | undefined>;
export function debounced<S extends StandardSchemaV1 | WrappedSchema>(schema: S, ms: number): WrappedSchema<SchemaInput<S>>;
export function debounced(check: object, ms: number): unknown {
  const inner = checkOf(check);
  // `Object.assign` carries over the tags `validateOn` and `recheckOnSubmit` put on `check`.
  return Object.assign((value: unknown, ctx: { readonly signal: PlatformAbortSignal }) => {
    const { signal } = ctx;
    let flush: (() => void) | undefined;
    const wait = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      flush = () => {
        clearTimeout(timer);
        resolve();
      };
      // A newer run aborts this one's signal, which ends the wait.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      (signal as unknown as { addEventListener(type: string, run: () => void): void }).addEventListener("abort", flush);
    });
    // Validation reads `~flush` off the promise to end the wait on submit.
    return Object.assign(
      wait.then(() => (signal.aborted ? undefined : inner(value, ctx))),
      { "~flush": flush },
    );
  }, inner);
}

/**
 * Sets when a check first runs: `validateOn(check, "input")`. Without it the
 * check uses the timing `createForms` was given, `"blur"` by default. After
 * its first run a check runs on every input.
 *
 * `check` is a field validator, a form validator, a Standard Schema or any
 * of them already wrapped, and the result goes anywhere `check` does.
 */
export function validateOn<V, C, R>(check: (value: V, ctx: C) => R, on: ValidateTiming): (value: V, ctx: C) => R;
export function validateOn<S extends StandardSchemaV1 | WrappedSchema>(schema: S, on: ValidateTiming): WrappedSchema<SchemaInput<S>>;
export function validateOn(check: object, on: ValidateTiming): unknown {
  return tagged(check, { "~on": on });
}

/**
 * Makes a check run again on every submit, even when its last result is
 * still current. Use it for a check whose answer can change without the
 * value changing, such as a server lookup.
 *
 * `check` is a field validator, a form validator, a Standard Schema or any
 * of them already wrapped, and the result goes anywhere `check` does.
 */
export function recheckOnSubmit<V, C, R>(check: (value: V, ctx: C) => R): (value: V, ctx: C) => R;
export function recheckOnSubmit<S extends StandardSchemaV1 | WrappedSchema>(schema: S): WrappedSchema<SchemaInput<S>>;
export function recheckOnSubmit(check: object): unknown {
  return tagged(check, { "~recheck": true });
}
