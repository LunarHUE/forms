import type { FormError, MapError } from "../errors.js";
import type { Path } from "../path.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import type { ValidateTiming, ValidatorContext, ValidatorKind } from "../validator.js";
import type { PlatformAbortSignal } from "../value.js";
import type { FormContext } from "./context.js";
import { addErrors, type Placed } from "./placed.js";
import type { SchemaOutput, Validation, ValidationOptions } from "./runner.js";
import type { ItemValidators } from "./validate/fields.js";
import { type Spec, toSpec } from "./validate/inputs.js";
import { place, thrownMessage } from "./validate/place.js";
import { keyOf, type Pattern, startsWith } from "./validate/paths.js";
import { copyTree } from "./tree.js";

// Core has no DOM or node types, so this declares the platform globals validation uses.
declare const AbortController: new () => { readonly signal: PlatformAbortSignal; abort(): void };

/**
 * One validator from the definition or from `register`. Its pattern names
 * one field, or every field that matches when it has `item` segments. Each
 * registration is one owner in the core, named `<kind><n>`, as `field3`, so that
 * `errorsByKind` can group a field's errors without the store keeping more.
 */
export interface Registration {
  readonly owner: string;
  readonly spec: Spec;
  readonly pattern: Pattern;
  readonly timing: ValidateTiming;
  /** True when it can place errors below its field, so a blur below it runs it for the blurred subtree. */
  readonly reaches: boolean;
  /** The runs by field path key. */
  readonly runs: Map<string, Run>;
  /**
   * Only on a registration with `item` segments, which `fieldValidators`
   * makes. Set by submit and `validate()` on the root: runs made after that
   * start armed.
   */
  armedAll?: boolean;
}

/** One registration on one concrete field. */
export interface Run {
  readonly reg: Registration;
  readonly path: Path;
  readonly key: string;
  /** Runs on every touching write once set. */
  armed: boolean;
  /** Before it is armed, the subtrees blurred below it. A run writes errors only inside them. */
  scopes?: Path[] | undefined;
  /** True once it ran while armed. A reset at or below its field clears it. */
  ran?: boolean;
  thrown?: boolean;
  /** The latest call, whose result is the one that lands. */
  call?: Call | undefined;
  /** True while the latest call's promise is pending. */
  inflight?: boolean;
  /** True while this run has the field's validating mark. */
  marked?: boolean;
  /** The fields this run put errors on, to clear on its next run. */
  readonly written: Map<string, Path>;
  waiters: (() => void)[];
}

/** One call of a check. Its abort controller is made the first time the check reads `signal`. */
interface Call {
  controller: { readonly signal: PlatformAbortSignal; abort(): void } | undefined;
  aborted: boolean;
  /** Ends the wait of a `debounced` check, so it runs now. */
  flush?: (() => void) | undefined;
}

// A primitive's `then` comes from its prototype, which nothing sets.
const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  typeof (value as { then?: unknown } | null | undefined)?.then === "function";

/** The promise a `debounced` check returns. */
interface Flushable {
  readonly "~flush"?: () => void;
}

// A result with no issues passed. An empty issue list counts as none, as `place` reads it.
const passed = (result: unknown): result is StandardSchemaV1.SuccessResult<unknown> => {
  // A schema check's result is a Standard Schema result.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const issues = (result as StandardSchemaV1.Result<unknown>).issues;
  return issues === undefined || issues.length === 0;
};

const defaultMapError: MapError<FormError> = (raw) => ({ message: raw.message });

/**
 * The validation runner: field and form validators, their timing, async
 * runs, and placing their errors on fields. Making it and
 * registering validators run nothing: validators first run on a write, a
 * blur, a submit or `validate()`.
 */
export function createValidation<V, E, I, R>(context: FormContext<V, E, I, R>, options: ValidationOptions<V, E>): Validation<E> {
  const { core } = context;
  // Without `mapError` the form's error type is `FormError`.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const mapError = options.mapError ?? (defaultMapError as unknown as MapError<E>);
  const formTiming = options.timing ?? "blur";
  // Every run.
  const all = new Set<Run>();
  let nextOwner = 0;

  // A spec's kind is "form" for the schema too, so the schema passes its own.
  const makeRegistration = (pattern: Pattern, spec: Spec, kind?: ValidatorKind): Registration => {
    const owner = (kind ?? spec.kind) + nextOwner++;
    core.addOwner(owner);
    return {
      owner,
      spec,
      pattern,
      timing: spec.on ?? formTiming,
      reaches: spec.kind === "form" || spec.schema,
      runs: new Map(),
    };
  };

  // The run of `reg` at `path`, made on first use.
  const runOf = (reg: Registration, path: Path): Run => {
    const key = keyOf(path);
    let run = reg.runs.get(key);
    if (!run) {
      run = {
        reg,
        path: Object.freeze(path.map(String)),
        key,
        armed: !!reg.armedAll,
        written: new Map(),
        waiters: [],
      };
      reg.runs.set(key, run);
      all.add(run);
    }
    return run;
  };

  // Adds the runs above `path` when `up`, at it when `at` and below it when `down`.
  const near = (path: Path, up: boolean, at: boolean, down: boolean, out = new Set<Run>()) => {
    for (const run of all) {
      const depth = run.path.length - path.length;
      if (depth < 0 ? up && startsWith(path, run.path) : (depth > 0 ? down : at) && startsWith(run.path, path)) out.add(run);
    }
    return out;
  };

  const busy = (run: Run) => run.inflight;

  const mark = (run: Run, on: boolean) => {
    if (run.marked === on) return;
    run.marked = on;
    core.setValidating(run.reg.owner, run.path, on);
  };

  // Resolves the waiters once the run has nothing pending.
  const settle = (run: Run) => {
    if (busy(run)) return;
    mark(run, false);
    const waiters = run.waiters;
    run.waiters = [];
    for (const resolve of waiters) resolve();
  };

  const idle = (run: Run): Promise<void> | undefined =>
    busy(run) ? new Promise((resolve) => void run.waiters.push(resolve)) : undefined;

  // Stops the call in flight. Its result never lands.
  const stop = (run: Run) => {
    const call = run.call;
    run.call = undefined;
    run.inflight = false;
    if (call) {
      call.aborted = true;
      call.controller?.abort();
    }
  };

  // Drops a run whose field is gone or whose registration was removed.
  const drop = (run: Run) => {
    if (!all.delete(run)) return;
    stop(run);
    settle(run);
    run.reg.runs.delete(run.key);
  };

  const live = (run: Run): boolean => {
    if (all.has(run) && core.isLive(run.path)) return true;
    drop(run);
    return false;
  };

  // True when the run may write errors at `path` now.
  const inScope = (run: Run, path: Path): boolean =>
    run.armed || !!run.scopes?.some((scope) => startsWith(path, scope));

  // Replaces the run's earlier errors with `placed`, inside its scope.
  const write = (run: Run, placed: Placed<E>) => {
    const { owner } = run.reg;
    for (const [key, path] of run.written) {
      if (placed.has(key) || !inScope(run, path)) continue;
      run.written.delete(key);
      core.setValidationErrors(owner, path, []);
    }
    for (const [key, { path, errors }] of placed) {
      if (!inScope(run, path) || !core.isLive(path)) continue;
      run.written.set(key, path);
      core.setValidationErrors(owner, path, errors);
    }
  };

  // The form schema's registration, and the output of its last run that passed.
  let schemaReg: Registration | undefined;
  let captured: SchemaOutput | undefined;

  // `input` is the value the check ran on.
  const land = (run: Run, result: unknown, input: unknown) => {
    if (run.reg === schemaReg) captured = passed(result) ? { input, output: result.value } : undefined;
    write(run, place(core, run.reg.spec, run.path, result, mapError));
  };

  const fail = (run: Run, cause: unknown) => {
    if (run.reg === schemaReg) captured = undefined;
    run.thrown = true;
    const placed: Placed<E> = new Map();
    addErrors(placed, run.path, [mapError({ source: "thrown", message: thrownMessage(cause), path: run.path, cause })]);
    write(run, placed);
  };

  // Calls the check on the field's current value. Sync results land before it returns.
  const execute = (run: Run) => {
    if (!live(run)) return;
    stop(run);
    if (run.armed) run.ran = true;
    run.thrown = false;
    const call: Call = { controller: undefined, aborted: false };
    run.call = call;
    const ctx: ValidatorContext<E> = {
      get signal() {
        if (!call.controller) {
          call.controller = new AbortController();
          if (call.aborted) call.controller.abort();
        }
        return call.controller.signal;
      },
      path: run.path,
      store: context.store(),
    };
    const input = core.getSnapshot(run.path).value;
    let result: unknown;
    try {
      result = run.reg.spec.check(input, ctx);
    } catch (cause) {
      run.call = undefined;
      fail(run, cause);
      settle(run);
      return;
    }
    if (!isThenable(result)) {
      run.call = undefined;
      land(run, result, input);
      settle(run);
      return;
    }
    run.inflight = true;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    call.flush = (result as Flushable)["~flush"];
    mark(run, true);
    const finish = (apply: () => void) => {
      // A newer call, a reset or a removal took over, so this result is dropped.
      if (run.call !== call) return;
      run.call = undefined;
      run.inflight = false;
      core.batch(() => {
        if (live(run)) apply();
        settle(run);
      });
    };
    void result.then(
      (value) => finish(() => land(run, value, input)),
      (cause: unknown) => finish(() => fail(run, cause)),
    );
  };

  const arm = (run: Run) => {
    run.armed = true;
    run.scopes = undefined;
  };

  // A user-edit write touched the run's field.
  const touch = (run: Run) => {
    if (!live(run)) return;
    if (!run.armed && run.reg.timing === "input") arm(run);
    if (run.armed || run.scopes) execute(run);
  };

  // Runs every registration at and below `path` now, arming each, and resolves once they land.
  const runNow = (path: Path, rerun: (run: Run) => boolean): Promise<unknown> => {
    const runs = near(path, false, true, true);
    loose?.(path, 0, runs);
    const waits: Promise<void>[] = [];
    core.batch(() => {
      for (const run of runs) {
        if (!live(run)) continue;
        arm(run);
        if (rerun(run)) execute(run);
        // Submit and `validate()` skip the wait of a `debounced` check.
        run.call?.flush?.();
        const wait = idle(run);
        if (wait) waits.push(wait);
      }
    });
    return Promise.all(waits);
  };

  // A registration on one field gets its run now. One with `item` segments gets runs as items match.
  const add = (pattern: Pattern, spec: Spec, kind?: ValidatorKind, items?: boolean): Registration => {
    const reg = makeRegistration(pattern, spec, kind);
    // Without `item` segments a pattern is a path.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    if (!items) runOf(reg, pattern as Path);
    return reg;
  };

  // The definition's validators, in error order: the schema, the form validator, then field validators.
  if (options.schema) {
    const spec = toSpec(options.schema, "form");
    if (spec) schemaReg = add([], spec, "schema");
  }
  // `formValidator` made `form`, which adds its registration.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  options.validate?.form?.(add as never);
  // `fieldValidators` made `fields`, which takes this runner's parts and returns the item validators.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const loose = options.validate?.fields?.(core as never, add as never, runOf as never) as ItemValidators | undefined;

  return {
    register(path, validator) {
      const spec = toSpec(validator, "field");
      if (!spec) return () => {};
      const reg = add(path.map(String), spec);
      return () => {
        for (const run of reg.runs.values()) drop(run);
        core.removeOwner(reg.owner);
      };
    },
    async validate(path) {
      await runNow(path, () => true);
      return !core.invalidAt(path);
    },
    written(path) {
      const runs = near(path, true, true, true);
      loose?.(path, 1, runs);
      for (const run of runs) touch(run);
    },
    blurred(path) {
      const runs = near(path, true, true, false);
      loose?.(path, 2, runs);
      const key = keyOf(path);
      for (const run of runs) {
        if (run.armed || run.reg.timing !== "blur" || !live(run)) continue;
        if (run.key === key) {
          // Blur arms the validators at exactly the blurred field.
          arm(run);
          execute(run);
        } else if (run.reg.reaches && !inScope(run, path)) {
          // A form validator or schema above the field runs for the blurred subtree only,
          // so a blur on one field doesn't put errors on fields not yet visited.
          (run.scopes ??= []).push(path);
          execute(run);
        }
      }
    },
    reset(path) {
      for (const run of near(path, false, true, true)) {
        stop(run);
        settle(run);
        if (run.reg.armedAll !== undefined) {
          drop(run);
          continue;
        }
        run.armed = false;
        run.scopes = undefined;
        run.ran = false;
        run.thrown = false;
        // The baseline clears the errors.
        run.written.clear();
      }
      // A run above the subtree forgets the blurs inside it. The baseline clears
      // its errors there without running it, so the next submit runs it again.
      for (const run of near(path, true, false, false)) {
        run.ran = false;
        run.scopes = run.scopes?.filter((scope) => !startsWith(scope, path));
        if (!run.scopes?.length) run.scopes = undefined;
      }
      loose?.(path, 4);
    },
    changed(paths) {
      const runs = new Set<Run>();
      for (const path of paths) {
        near(path, true, true, true, runs);
        loose?.(path, 3, runs);
      }
      for (const run of runs) if (live(run) && (run.armed || run.scopes)) execute(run);
    },
    async settleForSubmit() {
      await runNow([], (run) => !run.ran || run.thrown || run.reg.spec.recheckOnSubmit);
    },
    async schemaOutput() {
      const value = core.getSnapshot([]).value;
      // The value is frozen in development, and onSubmit's type lets it write, so it gets a copy in every build.
      if (!schemaReg) return { input: value, output: copyTree(value) };
      if (captured && Object.is(captured.input, value)) return captured;
      const run = runOf(schemaReg, []);
      core.batch(() => {
        arm(run);
        execute(run);
      });
      await idle(run);
      return captured;
    },
  };
}
