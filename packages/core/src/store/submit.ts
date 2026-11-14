import type { SubmitContext } from "../definition.js";
import type { ErrorMap } from "../errors.js";
import type { AnyFieldHandle } from "../handle.js";
import type { Submission } from "../snapshot.js";
import type { DisabledInvalid, IntentArgs } from "../store.js";
import type { DeepReadonly, PlatformAbortSignal } from "../value.js";
import type { FormContext } from "./context.js";
import { errorList } from "./handles.js";
import type { PluginHost } from "./plugins.js";
import { addErrors, type Placed } from "./placed.js";
import type { Validation } from "./runner.js";

// Core has no DOM or node types, so this declares the platform global submit uses.
declare const AbortController: new () => { readonly signal: PlatformAbortSignal; abort(): void };

/** The store options submit reads. `O` is what `onSubmit` gets: the schema's output, or the value. */
export interface SubmitOptions<V, E, I, R, O = V> {
  /** Called when a submit passes validation. What it returns becomes the result, what it throws the error. */
  readonly onSubmit?: ((value: O, ctx: SubmitContext<V, E, I>) => R | Promise<R>) | undefined;
}

/** Submitting, form-wide user errors and finding invalid fields. */
export interface Submit<E, I, R> {
  /** As `FormStore.submit`. */
  submit(this: void, ...args: IntentArgs<I>): Promise<Submission<I, R>>;
  /** As `FormStore.handleSubmit`. */
  handleSubmit(this: void, event?: { preventDefault(): void }): Promise<void>;
  /** As `FormStore.setErrors`. */
  setErrors(this: void, errors: ErrorMap<E>): void;
  /** As `FormStore.firstInvalid`. */
  firstInvalid(this: void): AnyFieldHandle<E> | undefined;
  /** As `FormStore.disabledInvalid`. */
  disabledInvalid(this: void): DisabledInvalid<E>[];
  /** Called when the whole form is reset, inside the reset's batch, to abort a running submit. */
  abort(): void;
}

type Controller = { readonly signal: PlatformAbortSignal; abort(): void };

/** Makes submit. Making it runs nothing: no controller or promise exists until `submit` is called. */
export function createSubmit<V, E, I, R, O = V>(
  context: FormContext<V, E, I, R>,
  options: SubmitOptions<V, E, I, R, O>,
  validation: Validation<E>,
  host?: PluginHost,
): Submit<E, I, R> {
  const { core } = context;
  // The running submit, by its controller, which belongs to that run alone.
  let running: { readonly controller: Controller; readonly promise: Promise<Submission<I, R>> } | undefined;
  // What an aborted run resolves to: the idle submission its abort set.
  const aborted = new WeakMap<Controller, Submission<I, R>>();
  let count = 0;
  // False while the submission is anything but idle, so a reset of an idle form changes nothing.
  let idleNow = true;

  // Ends the run with `submission`, unless an abort ended it first. `input` is the value `onSubmit` got, if it was called.
  const end = (controller: Controller, submission: Submission<I, R>, input?: unknown): Submission<I, R> => {
    const idle = aborted.get(controller);
    if (idle) return idle;
    running = undefined;
    core.setSubmission(submission);
    host?.submitted(submission, input);
    return submission;
  };

  // `settled` resolves true when a plugin refused the submit.
  const execute = async (controller: Controller, intent: I, settled: Promise<unknown>): Promise<Submission<I, R>> => {
    const out = (await settled) || aborted.has(controller) || core.invalidAt([]) ? undefined : await validation.schemaOutput();
    const idle = aborted.get(controller);
    if (idle) return idle;
    // Errors that landed while the schema ran block the submit too, and so does a plugin's refusal.
    if (!out || core.invalidAt([])) return end(controller, { status: "invalid" });
    const ctx: SubmitContext<V, E, I> = {
      store: context.store(),
      intent,
      signal: controller.signal,
      // The value validation passed on is the form's value, of type V.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      input: out.input as DeepReadonly<V>,
    };
    try {
      // The schema's output, or the form value without a schema, which is what `O` names.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const result = options.onSubmit ? await options.onSubmit(out.output as O, ctx) : (undefined as R);
      return end(controller, { status: "succeeded", result }, out.input);
    } catch (error) {
      return end(controller, { status: "failed", error }, out.input);
    }
  };

  const start = (intent: I): Promise<Submission<I, R>> => {
    if (running) return running.promise;
    idleNow = false;
    const controller = new AbortController();
    let settled: Promise<unknown> = Promise.resolve();
    // One batch: the previous attempt's user errors go, the count and status
    // change, and validators that finish at once land.
    core.batch(() => {
      core.clearUserErrors([]);
      core.setSubmitCount(++count);
      core.setSubmission({ status: "submitting", intent });
      settled = validation.settleForSubmit();
      // Plugins' submit work runs alongside validation, and the schema output waits for both.
      if (host) settled = host.submitting(settled);
    });
    const promise = execute(controller, intent, settled);
    running = { controller, promise };
    return promise;
  };

  return {
    // With no argument the intent is undefined, which `IntentArgs` allows only when I includes it.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    submit: (...args) => start(args[0] as I),
    async handleSubmit(event) {
      event?.preventDefault();
      // The form's submit event carries no intent, so this submit's intent is undefined whatever I is.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      await start(undefined as I);
    },
    setErrors(errors) {
      // Errors for one field from `form` and `fields` are joined, `form` first.
      const lists: Placed<E> = new Map();
      if (errors.form !== undefined) addErrors(lists, [], errorList(errors.form));
      // A name that resolves to no field lands on the root after the form errors, as validation does.
      for (const [name, entry] of Object.entries(errors.fields ?? {}))
        if (entry !== undefined) addErrors(lists, core.pathOf(name) ?? [], errorList(entry));
      core.batch(() => {
        core.clearUserErrors([]);
        for (const { path, errors: list } of lists.values()) core.setUserErrors(path, list);
      });
    },
    firstInvalid() {
      const path = core.firstInvalid();
      return path && context.store().fieldAt(path);
    },
    disabledInvalid() {
      const found: DisabledInvalid<E>[] = [];
      for (const path of core.disabledInvalid()) {
        const field = context.store().fieldAt(path);
        if (!field) continue;
        const { name, errors } = core.getSnapshot(path);
        found.push({ field, name, errors });
      }
      return found;
    },
    abort() {
      const run = running;
      running = undefined;
      const idle: Submission<I, R> = { status: "idle" };
      if (run) aborted.set(run.controller, idle);
      // Reset puts a settled submission back to idle too, as a fresh form has none.
      if (!idleNow) {
        idleNow = true;
        core.setSubmission(idle);
      }
      // Last, so a signal listener that submits again starts from idle.
      run?.controller.abort();
    },
  };
}
