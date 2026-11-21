import type { StandardSchemaV1 } from "./standard-schema.js";
import { isPlainObject } from "./store/tree.js";
import { isSchema, isThenable, stepSlot, type StepHook, type Tags } from "./store/validate/inputs.js";
import type { SchemaInput, ValidateTiming, WrappedSchema } from "./validator.js";
import type { PlatformAbortSignal } from "./value.js";

// Core has no DOM or node types, so this declares the platform globals it uses.
declare function setTimeout(run: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;

/** A check as the wrappers call it. */
type AnyCheck = ((value: unknown, ctx: { readonly signal: PlatformAbortSignal }) => unknown) & Tags;

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

/** What a validator gets besides the value, as the wrappers need it. */
type Ctx = { readonly signal: PlatformAbortSignal; readonly [stepSlot]?: StepHook };

/** Direct `pipe()` functions mapped to their flattened checks, so nested pipes share one step index space. */
const pipedSteps = new WeakMap<object, readonly AnyCheck[]>();

/** A check in a `pipe` with function checks: a validator, a schema, or either wrapped. */
type Step<V, C, R> = ((value: V, ctx: C) => R | Promise<R>) | StandardSchemaV1<V, unknown> | WrappedSchema<V>;

/** The validator a `pipe` with function checks returns. `R` is what its checks return. */
type Piped<V, C, R> = (value: V, ctx: C) => R | undefined | Promise<R | undefined>;

/**
 * True when a check's result holds an error. A field validator returns errors
 * or none, and a form validator an `ErrorMap`, which holds an error only when
 * an entry has one. `pipe` can't tell the two kinds apart, so a plain object
 * with no keys but `form` and `fields` reads as an `ErrorMap`.
 */
const failed = (result: unknown, schema?: boolean): boolean => {
  // A schema pipe that passed returns nothing, so a schema check can give `undefined` here.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  if (schema) return !!(result as StandardSchemaV1.Result<unknown> | undefined)?.issues?.length;
  if (Array.isArray(result)) return result.length > 0;
  if (isPlainObject(result) && Object.keys(result).every((key) => key === "form" || key === "fields")) {
    const { form, fields } = result;
    return failed(form) || (isPlainObject(fields) && Object.values(fields).some((errors) => failed(errors)));
  }
  return result !== undefined && result !== null;
};

/**
 * Runs checks one after another on the same value and stops at the first
 * that finds an error: `pipe(required, format, debounced(lookup, 400))`. A
 * check passes when it returns `undefined`, `null`, an empty list, an
 * `ErrorMap` with no errors, or a schema result with no issues.
 *
 * While its checks answer at once, the pipe answers at once. A check that
 * fails stops the pipe before the next one starts, so a `debounced` check
 * after it never waits and the field never shows `validating`. An async
 * check makes the rest wait for it, and a newer run stops the older one
 * there. Submit and `validate()` skip the wait of a `debounced` check,
 * whether the pipe has reached it yet or not.
 *
 * Each check is a field validator, a form validator, a Standard Schema or
 * any of them already wrapped, and the pipe goes anywhere its checks do.
 * Wrap the pipe in `validateOn` to set its timing: the timing of a check
 * inside it is ignored. A check wrapped in `recheckOnSubmit` makes the whole
 * pipe run again on submit.
 */
export function pipe<S extends readonly (StandardSchemaV1 | WrappedSchema)[]>(...schemas: S): WrappedSchema<SchemaInput<S[number]>>;
// One overload per length, so each check's result type is inferred on its own
// and checks that return different shapes don't conflict.
export function pipe<V, C extends Ctx, A>(a: Step<V, C, A>): Piped<V, C, A>;
export function pipe<V, C extends Ctx, A, B>(a: Step<V, C, A>, b: Step<V, C, B>): Piped<V, C, A | B>;
export function pipe<V, C extends Ctx, A, B, D>(a: Step<V, C, A>, b: Step<V, C, B>, d: Step<V, C, D>): Piped<V, C, A | B | D>;
export function pipe<V, C extends Ctx, A, B, D, F>(
  a: Step<V, C, A>,
  b: Step<V, C, B>,
  d: Step<V, C, D>,
  f: Step<V, C, F>,
): Piped<V, C, A | B | D | F>;
export function pipe<V, C extends Ctx, A, B, D, F, G>(
  a: Step<V, C, A>,
  b: Step<V, C, B>,
  d: Step<V, C, D>,
  f: Step<V, C, F>,
  g: Step<V, C, G>,
): Piped<V, C, A | B | D | F | G>;
// Past five checks, every check's result type must fit one `R`.
export function pipe<V, C extends Ctx, R>(...steps: readonly Step<V, C, R>[]): Piped<V, C, R>;
export function pipe(...steps: object[]): unknown {
  const checks = steps.flatMap((step) => pipedSteps.get(step) ?? [checkOf(step)]);
  const run = Object.assign(
    (value: unknown, ctx: Ctx) => {
      // Set once submit or `validate()` flushes the run, so a `debounced` check reached later skips its wait.
      let flushed = false;
      let flush: (() => void) | undefined;
      const onStep = ctx[stepSlot];
      // Runs the checks from `index` on. Sync until a check returns a promise.
      const from = (index: number): unknown => {
        const check = checks[index];
        if (!check) return undefined;
        const next = (answer: unknown) => {
          if (!failed(answer, check["~schema"])) {
            onStep?.(index, false);
            return from(index + 1);
          }
          onStep?.(index, true);
          // Marks a schema check's issues, so they go through `mapError` in a pipe whose other checks return errors.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          return check["~schema"] ? { "~schema": true, issues: (answer as StandardSchemaV1.FailureResult).issues } : answer;
        };
        const answer = check(value, ctx);
        if (!isThenable(answer)) return next(answer);
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        flush = (answer as { readonly "~flush"?: () => void })["~flush"];
        if (flushed) flush?.();
        return answer.then((settled) => (ctx.signal.aborted ? undefined : next(settled)));
      };
      const answer = from(0);
      return isThenable(answer)
        ? Object.assign(answer, {
            "~flush": () => {
              flushed = true;
              flush?.();
            },
          })
        : answer;
    },
    // A pipe of schemas returns schema results, so it reads as a schema.
    { "~schema": checks.every((check) => check["~schema"]), "~recheck": checks.some((check) => check["~recheck"]) },
  );
  pipedSteps.set(run, checks);
  return run;
}
