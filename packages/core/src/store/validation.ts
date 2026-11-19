import type { FormError, MapError } from "../errors.js";
import type { Path } from "../path.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import type { ValidateTiming, ValidatorContext } from "../validator.js";
import type { PlatformAbortSignal } from "../value.js";
import type { FormContext } from "./context.js";
import { addErrors, type Placed } from "./placed.js";
import type { SchemaOutput, Validation, ValidationOptions } from "./runner.js";
import { readFields, type Spec, toSpec } from "./validate/inputs.js";
import { place, thrownMessage } from "./validate/place.js";
import {
  along,
  below,
  isConcrete,
  item,
  keyOf,
  matches,
  type Pattern,
  removeAt,
  type Slot,
  slot,
  slotAt,
  startsWith,
} from "./validate/paths.js";
import { copyTree } from "./tree.js";

// Core has no DOM or node types, so this declares the platform globals validation uses.
declare function setTimeout(run: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;
declare const AbortController: new () => { readonly signal: PlatformAbortSignal; abort(): void };

/**
 * One validator from the definition or from `register`. Its pattern names
 * one field, or every field that matches when it has `item` segments. Each
 * registration is one owner in the core.
 */
interface Registration {
  readonly owner: string;
  readonly spec: Spec;
  readonly pattern: Pattern;
  readonly timing: ValidateTiming;
  /** True when it can place errors below its field, so a blur below it runs it for the blurred subtree. */
  readonly reaches: boolean;
  /** The runs by field path key. */
  readonly runs: Map<string, Run>;
  /** Set by submit and `validate()` on the root: runs made after that start armed. */
  armedAll?: boolean;
}

/** One registration on one concrete field. */
interface Run {
  readonly reg: Registration;
  readonly path: Path;
  readonly key: string;
  /** Runs on every touching write once set. */
  armed: boolean;
  /** Before it is armed, the subtrees blurred below it. A run writes errors only inside them. */
  scopes?: Map<string, Path> | undefined;
  /** True once it ran while armed. A reset at or below its field clears it. */
  ran?: boolean;
  thrown?: boolean;
  timer?: unknown;
  /** The latest call, whose result is the one that lands. */
  call?: Call | undefined;
  /** True while the latest call's promise is pending. */
  inflight?: boolean;
  /** True while this run has the field's validating mark. */
  marked?: boolean;
  /** The fields this run put errors on, to clear on its next run. */
  readonly written: Map<string, Path>;
  waiters: (() => void)[];
  removed?: boolean;
}

/** One call of a check. Its abort controller is made the first time the check reads `signal`. */
interface Call {
  controller: { readonly signal: PlatformAbortSignal; abort(): void } | undefined;
  aborted: boolean;
}

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === "object" || typeof value === "function") &&
  value !== null &&
  "then" in value &&
  typeof value.then === "function";

// A result with no issues passed. An empty issue list counts as none, as `place` reads it.
const passed = (result: unknown): result is StandardSchemaV1.SuccessResult<unknown> => {
  // A schema check's result is a Standard Schema result.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const issues = (result as StandardSchemaV1.Result<unknown>).issues;
  return issues === undefined || issues.length === 0;
};

const defaultMapError: MapError<FormError> = (raw) => ({ message: raw.message });

/**
 * The validation runner: field and form validators, their timing, debounce
 * and async runs, and placing their errors on fields. Making it and
 * registering validators run nothing: validators first run on a write, a
 * blur, a submit or `validate()`.
 */
export function createValidation<V, E, I, R>(context: FormContext<V, E, I, R>, options: ValidationOptions<V, E>): Validation<E> {
  const { core } = context;
  // Without `mapError` the form's error type is `FormError`.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const mapError = options.mapError ?? (defaultMapError as unknown as MapError<E>);
  const formTiming = options.validate?.on ?? options.timing ?? "blur";
  // Concrete runs by field path.
  const runsAt: Slot<Run> = slot();
  // Registrations with `item` segments. A definition has few, so writes loop over them.
  const patterns = new Set<Registration>();
  let nextOwner = 0;

  const makeRegistration = (pattern: Pattern, spec: Spec): Registration => {
    const owner = `validator:${nextOwner++}`;
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
      const at = slotAt(runsAt, run.path, true);
      (at.values ??= new Set()).add(run);
    }
    return run;
  };

  const busy = (run: Run) => run.timer !== undefined || run.inflight;

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

  // Stops the pending debounce and the call in flight. Their results never land.
  const stop = (run: Run) => {
    if (run.timer !== undefined) clearTimeout(run.timer);
    run.timer = undefined;
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
    if (run.removed) return;
    run.removed = true;
    stop(run);
    settle(run);
    run.reg.runs.delete(run.key);
    removeAt(runsAt, run.path, run);
  };

  const live = (run: Run): boolean => {
    if (!run.removed && core.isLive(run.path)) return true;
    drop(run);
    return false;
  };

  // True when the run may write errors at `path` now.
  const inScope = (run: Run, path: Path): boolean => {
    if (run.armed) return true;
    const scopes = run.scopes;
    if (!scopes) return false;
    for (let i = run.path.length; i <= path.length; i++) if (scopes.has(keyOf(path.slice(0, i)))) return true;
    return false;
  };

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
    run.timer = undefined;
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

  // Starts a run. A debounced check waits unless `now` is true. Either way the older call is stale from here.
  const start = (run: Run, now: boolean) => {
    stop(run);
    const wait = run.reg.spec.debounce;
    if (now || wait === 0) {
      execute(run);
      return;
    }
    mark(run, true);
    run.timer = setTimeout(() => core.batch(() => execute(run)), wait);
  };

  const arm = (run: Run) => {
    run.armed = true;
    run.scopes = undefined;
  };

  // A user-edit write touched the run's field.
  const touch = (run: Run) => {
    if (!live(run)) return;
    if (!run.armed && run.reg.timing === "input") arm(run);
    if (run.armed || run.scopes) start(run, false);
  };

  // Adds the runs of pattern registrations whose fields are `path` or lie under it.
  const expand = (reg: Registration, path: Path, out: Set<Run>) => {
    const { pattern } = reg;
    if (path.length === pattern.length) {
      out.add(runOf(reg, path));
      return;
    }
    const seg = pattern[path.length];
    if (seg !== item) {
      if (seg !== undefined) expand(reg, [...path, seg], out);
      return;
    }
    const snapshot = core.getSnapshot(path);
    if (!Array.isArray(snapshot.value)) return;
    for (const key of snapshot.keys ?? []) expand(reg, [...path, key], out);
  };

  // Adds the pattern runs at or under `path`, and, with `above`, the one at or above it.
  const patternRuns = (reg: Registration, path: Path, above: boolean, out: Set<Run>) => {
    const { pattern } = reg;
    if (pattern.length <= path.length) {
      if (above && matches(pattern, path, pattern.length)) out.add(runOf(reg, path.slice(0, pattern.length)));
    } else if (matches(pattern, path, path.length)) expand(reg, path, out);
  };

  // Runs every registration at and below `path` now, arming each, and resolves once they land.
  const runNow = (path: Path, rerun: (run: Run) => boolean): Promise<unknown> => {
    const runs = new Set<Run>();
    below(slotAt(runsAt, path, false), true, runs);
    for (const reg of patterns) patternRuns(reg, path, false, runs);
    const waits: Promise<void>[] = [];
    core.batch(() => {
      for (const run of runs) {
        if (!live(run)) continue;
        arm(run);
        if (rerun(run)) start(run, true);
        else if (run.timer !== undefined) execute(run);
        const wait = idle(run);
        if (wait) waits.push(wait);
      }
    });
    return Promise.all(waits);
  };

  const add = (pattern: Pattern, spec: Spec): Registration => {
    const reg = makeRegistration(pattern, spec);
    if (isConcrete(pattern)) runOf(reg, pattern);
    else patterns.add(reg);
    return reg;
  };

  // The definition's validators, in error order: the schema, the form validator, then field validators.
  if (options.schema) {
    const spec = toSpec(options.schema, "form");
    if (spec) schemaReg = add([], spec);
  }
  const formSpec = toSpec(options.validate?.form, "form");
  if (formSpec) add([], formSpec);
  for (const { pattern, spec } of readFields(options.validate?.fields)) add(pattern, spec);

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
      if (path.length === 0) for (const reg of patterns) reg.armedAll = true;
      await runNow(path, () => true);
      return !core.invalidAt(path);
    },
    written(path) {
      const runs = new Set<Run>();
      along(runsAt, path, true, runs);
      below(slotAt(runsAt, path, false), false, runs);
      // Only a pattern that arms on a write needs runs made for it. Runs that exist are in the trie.
      for (const reg of patterns) if (reg.armedAll || reg.timing === "input") patternRuns(reg, path, true, runs);
      for (const run of runs) touch(run);
    },
    blurred(path) {
      const runs = new Set<Run>();
      along(runsAt, path, true, runs);
      for (const reg of patterns) {
        const { length } = reg.pattern;
        if (reg.timing === "blur" && (length === path.length || (reg.reaches && length < path.length)))
          patternRuns(reg, path, true, runs);
      }
      const key = keyOf(path);
      for (const run of runs) {
        if (run.armed || run.reg.timing !== "blur" || !live(run)) continue;
        if (run.key === key) {
          // Blur arms the validators at exactly the blurred field.
          arm(run);
          start(run, false);
        } else if (run.reg.reaches && !inScope(run, path)) {
          // A form validator or schema above the field runs for the blurred subtree only,
          // so a blur on one field doesn't put errors on fields not yet visited.
          (run.scopes ??= new Map()).set(key, path);
          start(run, false);
        }
      }
    },
    reset(path) {
      const runs = new Set<Run>();
      below(slotAt(runsAt, path, false), true, runs);
      for (const run of runs) {
        stop(run);
        settle(run);
        if (!isConcrete(run.reg.pattern)) {
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
      const above = new Set<Run>();
      along(runsAt, path, false, above);
      for (const run of above) {
        run.ran = false;
        if (run.scopes) {
          for (const [key, scope] of run.scopes) if (startsWith(scope, path)) run.scopes.delete(key);
          if (run.scopes.size === 0) run.scopes = undefined;
        }
      }
      if (path.length === 0) for (const reg of patterns) reg.armedAll = false;
    },
    changed(paths) {
      const runs = new Set<Run>();
      for (const path of paths) {
        along(runsAt, path, true, runs);
        below(slotAt(runsAt, path, false), false, runs);
        // Runs made for an armed pattern start armed. Other patterns only have the runs in the trie.
        for (const reg of patterns) if (reg.armedAll) patternRuns(reg, path, true, runs);
      }
      for (const run of runs) if (live(run) && (run.armed || run.scopes)) start(run, false);
    },
    async settleForSubmit() {
      for (const reg of patterns) reg.armedAll = true;
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
        start(run, true);
      });
      await idle(run);
      return captured;
    },
  };
}
