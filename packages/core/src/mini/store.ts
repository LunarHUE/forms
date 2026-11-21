import type { ErrorMap, FormError, Many } from "../errors.js";
import type { NamedAnyFieldHandle as FullAnyHandle, ResetOptions, WriteOptions } from "../handle.js";
import type { FieldPath, Path } from "../path.js";
import type { FieldDisplay, WriteCause } from "../plugin.js";
import type { PartWrite as FullPartWrite, ValuePartContext } from "../plugins/part.js";
import type { FieldSnapshotBase, FormSnapshotBase, Submission } from "../snapshot.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import type { FormStoreBase, IntentArgs } from "../store.js";
import type { ValidatorContext as FullValidatorContext } from "../validator.js";
import type { ChildValue, DeepReadonly, KeysOf, ShapeOf } from "../value.js";
import type { Cell, Cells } from "../store/cells.js";
import { errorId, fieldId } from "../store/ids.js";
import { refuse } from "../store/refuse.js";

// Core has no node types, so this declares the global the development check reads.
declare const process: { readonly env: { readonly NODE_ENV?: string } };

/** A field's state: the members of full's `FieldSnapshot` that mini keeps. */
export type FieldSnapshot<V, E = FormError> = Pick<FieldSnapshotBase<V, E>, "value" | "name" | "errors" | "shownErrors" | "invalid" | "touched">;

/** The form's state: the members of full's `FormSnapshot` that mini keeps. */
export type FormSnapshot<I = undefined, R = unknown> = Pick<FormSnapshotBase<I, R>, "valid" | "submitting" | "submission" | "submitCount">;

/** A field's handle: the members of full's handle that mini keeps. `setValue` ignores `replace`. */
export interface NamedAnyFieldHandle<E = FormError> extends Pick<FullAnyHandle<E>, "id" | "path" | "handleBlur" | "setErrors" | "setValue"> {
  /** Returns the field's current snapshot. Call it in event handlers and effects, never during render. */
  peek(): FieldSnapshot<unknown, E>;
}

/**
 * The store: the members of full's `FormStore` that mini keeps, with mini's
 * snapshots and handles. A full store fits this type.
 */
export interface FormStore<V, E = FormError, I = undefined, R = unknown>
  extends Pick<
    FormStoreBase<V, E, I, R>,
    "id" | "subscribeForm" | "batch" | "submit" | "handleSubmit" | "setErrors" | "reset" | "pathOf"
  > {
  /** Returns the form snapshot, the identical object until a member changes. */
  getFormSnapshot(): FormSnapshot<I, R>;
  /** Returns the form snapshot the store started with. */
  getServerFormSnapshot(): FormSnapshot<I, R>;
  /** The same as `getFormSnapshot`, for event handlers and effects. */
  peek(): FormSnapshot<I, R>;
  /** Returns the handle of the field at `path`. Mini makes one for any path, so it is never undefined. */
  fieldAt(path: Path): NamedAnyFieldHandle<E> | undefined;
}

/** A store of any value, as validators and parts see it. */
// `any` lets a store of every value type fit, as full's `AnyFormStore` does.
// oxlint-disable-next-line typescript/no-explicit-any
export type AnyFormStore<E = FormError> = FormStore<any, E, any, any>;

/** What a validator gets besides the value: the field's path and the store. */
export interface ValidatorContext<E = unknown> extends Pick<FullValidatorContext<E>, "path"> {
  /** The store the field belongs to. */
  readonly store: AnyFormStore<E>;
}

/** Checks one field's value. Mini's validators are sync: return the errors, or nothing when the value passed. */
export type Validator<V, E = FormError> = (value: V, ctx: ValidatorContext<E>) => Many<E> | undefined | null;

/** Validators shaped like the value: a validator at any field, or a record of them at an object. */
export type FieldValidators<V, E = FormError> =
  | Validator<V, E>
  | (ShapeOf<V> extends "object" ? { readonly [K in KeysOf<V>]?: FieldValidators<ChildValue<V, K>, E> } : never);

/** Marks the function `fieldValidators` returns. Types only. */
declare const validatorSet: unique symbol;

/** A definition's field validators, as `fieldValidators` wraps them. A function type, so `V` is inferred from the config around the call. */
export type FieldValidatorSet<V, E = FormError> = (
  core: never,
) => { readonly [validatorSet]: { readonly fields: (value: V) => V; readonly error: (error: E) => E } };

/** Wraps a definition's field validators: `validate: { fields: fieldValidators({ email: required }) }`. */
export const fieldValidators = <V, E = FormError>(fields: FieldValidators<V, E>): FieldValidatorSet<V, E> =>
  // The brand is types only. At runtime the set returns the record.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  (() => fields) as unknown as FieldValidatorSet<V, E>;

/** A write about to happen at a part's path, as `transform` sees it. */
export type PartWrite<V> = Pick<FullPartWrite<V>, "path" | "input" | "value" | "before" | "cause">;

/** What a part gets where it attaches: full's part context without the plugin members, and mini's handles. */
export interface PartContext<V> extends Pick<ValuePartContext<V>, "path" | "value" | "write"> {
  /** The handle of the field at dotted name `name` below the part's path. */
  at(this: void, name: string): NamedAnyFieldHandle<unknown>;
}

/** Where a part attaches its hooks: the field at the part's path. Internal. */
export interface PartTarget {
  /** Each runs before a write at the field and returns the value to keep, or `refuse`. */
  readonly writes: ((write: PartWrite<unknown>) => unknown)[];
  /** The first display a part here gave. */
  text: FieldDisplay | undefined;
}

/** The context a part attaches with: the public one, and the store's hooks. Internal. */
export interface AttachContext extends PartContext<unknown> {
  readonly "~field": PartTarget;
  /** Runs `run` after each write at, above or below the part's path. */
  readonly "~observe": (run: () => void) => void;
  /** Sets the value at the part's path before the store starts, as its starting value. */
  readonly "~start": (next: unknown) => void;
}

/**
 * A part made by mini's `transform`, `text` or `observe`. `P` is there so
 * the type reads as full's `Part<P, V>`. Mini has no plugins, so it is
 * always `never`. A part of full's doesn't fit, so mini's `define` rejects
 * it at compile time.
 */
export interface Part<P = never, V = never> {
  /** Attaches the part's hooks at one path. Internal. */
  readonly "~mini": (ctx: AttachContext) => void;
  /** A dotted name below where the part attaches. */
  readonly path?: string;
  /** Type information only: the values the part fits, and the plugin type it carries. */
  readonly "~fits"?: (value: V, plugin: P) => void;
}

/** One part or a list of them, as `define` takes them after the config. */
export type Parts<V> = Part<never, V> | readonly Part<never, V>[];

/** Chooses how listeners wake. See `perField`. */
export type { Subscribe } from "../store/cells.js";

/** What `createStore` takes. Internal. */
export interface StoreOptions<V, E, R> {
  readonly id?: string | undefined;
  readonly defaultValues: V;
  readonly schema?: StandardSchemaV1 | undefined;
  readonly validate?: { readonly fields?: FieldValidatorSet<V, E> | undefined } | undefined;
  readonly onSubmit?: ((value: never, ctx: never) => R | Promise<R>) | undefined;
  readonly parts?: readonly Part<never, unknown>[] | undefined;
  readonly subscribe?: (() => Cells) | undefined;
}

/** One field the store knows about. */
interface Field<E> extends Cell<FieldSnapshot<unknown, E>>, PartTarget {
  readonly path: Path;
  readonly name: string;
  readonly handle: NamedAnyFieldHandle<E>;
  touched: boolean;
  /** Validation errors. */
  found: readonly E[];
  /** Errors `setErrors` put here. */
  user: readonly E[];
}

const none: readonly never[] = [];

const list = <E>(result: Many<E> | null | undefined): readonly E[] => (result == null ? none : Array.isArray(result) ? result : [result as E]);

/** True when both lists hold the same elements in the same order. */
const same = (a: readonly unknown[], b: readonly unknown[]): boolean => a.length === b.length && a.every((item, index) => item === b[index]);

/**
 * Keeps an earlier snapshot when every member of `next` is the same as its
 * own, so an unchanged field keeps its identity. Full's `settle`, without
 * the development freeze and the module it lives in.
 */
const settle = <S extends object>(next: S, ...earlier: (S | undefined)[]): S =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  earlier.find((old) => old && Object.keys(next).every((key) => Object.is(next[key as keyof S], old[key as keyof S]))) ?? next;

const split = (name: string): Path => (name ? name.split(".") : []);

/** The value at `path` in `root`, through objects. */
// The value is the app's own, read by key.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion, typescript/no-explicit-any
const read = (root: unknown, path: Path): unknown => path.reduce((node: any, key) => node?.[key], root);

/** A copy of `root` with `next` at `path`, through objects only. A missing step becomes an object. */
const write = (root: unknown, path: Path, next: unknown, at = 0): unknown =>
  at < path.length ? { ...(root as object), [path[at] as string]: write(read(root, [path[at] as string]), path, next, at + 1) } : next;

/** True when one dotted name is at, above or below the other. */
const related = (a: string, b: string): boolean => !a || !b || `${a}.`.startsWith(`${b}.`) || `${b}.`.startsWith(`${a}.`);

/** Development only: mini's validators and schemas must be sync. */
const sync = <T>(result: T): T => {
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production" && result instanceof Promise) {
    throw new Error("@lunarhue/forms-core/mini: a validator or schema returned a promise. Mini validates sync only. Import the full entry for async validation.");
  }
  return result;
};

const idle: Submission<never, never> = { status: "idle" };
const idleForm: FormSnapshot<never, never> = { valid: true, submitting: false, submission: idle, submitCount: 0 };

/**
 * The default subscriptions: one list for the whole store. Every change
 * wakes every listener once, and each reader compares its snapshot.
 */
const wholeForm = (): Cells => {
  let depth = 0;
  let changed = false;
  const listeners = new Set<() => void>();
  const flush = () => {
    if (!depth && changed) {
      changed = false;
      for (const listener of listeners) listener();
    }
  };
  return [
    (cell, next) => {
      if (cell.snapshot !== next) {
        cell.snapshot = next;
        changed = true;
      }
    },
    (_cell, listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    flush,
    (fn) => {
      depth++;
      try {
        return fn();
      } finally {
        depth--;
        flush();
      }
    },
  ];
};

/** Makes a mini store: one table of fields by dotted name over one value. Internal: use `createFormsCore().define()`. */
export function createStore<V, E = FormError, R = unknown>(options: StoreOptions<V, E, R>): FormStore<V, E, undefined, R> {
  const { id = "form", schema, onSubmit } = options;
  const [replace, listen, , batch] = (options.subscribe ?? wholeForm)();
  let value: unknown = options.defaultValues;
  let start = value;
  let submitCount = 0;
  let submission: Submission<undefined, R> = idle;
  // Bumped by reset, so a submit that a reset passed lands nothing.
  let runs = 0;
  let running: Promise<Submission<undefined, R>> | undefined;
  // True inside a part's `ctx.write`, whose writes are no user edits.
  let quiet = false;
  const fields = new Map<string, Field<E>>();
  // A cell's other members start undefined, so they are left out.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const form = { snapshot: idleForm } as unknown as Cell<FormSnapshot<undefined, R>>;
  const observers: [string, () => void][] = [];

  // The validators by dotted name, read once from the value-shaped record.
  const validators: Record<string, (value: unknown, ctx: ValidatorContext<E>) => Many<E> | undefined | null> = {};
  const readValidators = (node: object, prefix: string): void => {
    for (const [key, entry] of Object.entries(node)) {
      if (typeof entry === "function") validators[prefix + key] = entry;
      else readValidators(entry, `${prefix}${key}.`);
    }
  };
  // The set is a function that returns the record. See `fieldValidators`.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const set = options.validate?.fields as (() => object) | undefined;
  if (set) {
    const record = set();
    // A function at the root validates the whole value.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    if (typeof record === "function") validators[""] = record as (typeof validators)[string];
    else readValidators(record, "");
  }

  const build = (field: Field<E>) => {
    const { found, user, snapshot } = field;
    const joined = user.length ? (found.length ? [...found, ...user] : user) : found;
    const errors = same(joined, snapshot.errors) ? snapshot.errors : joined;
    replace(
      field,
      settle(
        {
          value: read(value, field.path),
          name: field.name,
          errors,
          // Validation errors wait for a blur or a submit. Errors from `setErrors` show at once.
          shownErrors: field.touched || submitCount ? errors : user,
          invalid: errors.length > 0,
          touched: field.touched,
        },
        snapshot,
        field.before,
      ),
    );
  };

  // Brings every snapshot up to date. Commands run it inside a batch, which wakes listeners at its end.
  const refresh = () => {
    let valid = true;
    for (const field of fields.values()) {
      build(field);
      if (field.found.length) valid = false;
    }
    replace(form, settle({ valid, submitting: submission.status === "submitting", submission, submitCount }, form.snapshot, form.before));
  };

  // Runs validators and the schema, at `only` or everywhere. Returns the schema's output, or the value, when nothing failed.
  const check = (only?: string): { readonly output: unknown } | undefined => {
    const found = new Map<string, E[]>();
    const add = (name: string, errors: readonly E[]) => {
      if (errors.length) found.set(name, [...(found.get(name) ?? []), ...errors]);
    };
    let output = value;
    for (const name in validators) {
      if (only === undefined || only === name) add(name, list(sync(validators[name]?.(read(value, split(name)), { path: split(name), store }))));
    }
    if (schema) {
      const result = sync(schema["~standard"].validate(value)) as StandardSchemaV1.Result<unknown>;
      if (result.issues) {
        for (const issue of result.issues) {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          add((issue.path ?? []).map((step) => (typeof step === "object" ? step.key : step)).join("."), [{ message: issue.message } as E]);
        }
      } else output = result.value;
    }
    for (const name of found.keys()) fieldOf(name);
    for (const field of fields.values()) if (only === undefined || only === field.name) field.found = found.get(field.name) ?? none;
    return found.size ? undefined : { output };
  };

  // Runs the observers whose path is at, above or below `name`.
  const observe = (name: string) => {
    for (const [at, run] of observers) if (related(at, name)) run();
  };

  const fieldOf = (name: string): Field<E> => {
    let field = fields.get(name);
    if (field) return field;
    const path = split(name);
    const handleId = fieldId(id, path);
    const handle = {
      id: handleId,
      path,
      peek: () => field!.snapshot,
      handleBlur: () =>
        batch(() => {
          field!.touched = true;
          check(name);
          refresh();
        }),
      setErrors: (errors: Many<E>) =>
        batch(() => {
          field!.user = list(errors);
          refresh();
        }),
      setValue: (input: unknown, writeOptions?: WriteOptions) =>
        batch(() => {
          const before = read(value, path);
          // An updater gets the value there now, as full's leaf handles do.
          let next = typeof input === "function" ? (input as (previous: unknown) => unknown)(before) : input;
          const cause: WriteCause = quiet ? { plugin: "part" } : "user";
          for (const hook of field!.writes) {
            next = hook({ path, input, value: next, before, cause });
            if (next === refuse) return;
          }
          if (Object.is(next, before)) return;
          value = write(value, path, next);
          if (writeOptions?.edited ?? !quiet) {
            field!.user = none;
            // A field showing an error, or any field after a submit, is checked again as it changes.
            if (submitCount || field!.found.length) check(name);
          }
          refresh();
          observe(name);
        }),
      // For the React binding: a stable subscribe and the display.
      "~subscribe": (listener: () => void) => listen(field!, listener),
      "~text": () => field!.text,
      "~errorId": errorId(handleId),
    };
    // `build` below gives the first snapshot. It reads only `errors` from the one before.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    field = { path, name, handle, touched: false, found: none, user: none, writes: [], snapshot: { errors: none } } as unknown as Field<E>;
    fields.set(name, field);
    build(field);
    return field;
  };

  const submit = (): Promise<Submission<undefined, R>> => {
    if (running) return running;
    const run = runs;
    let passed: { readonly output: unknown } | undefined;
    batch(() => {
      for (const field of fields.values()) field.user = none;
      submitCount++;
      passed = check();
      submission = passed ? { status: "submitting", intent: undefined } : { status: "invalid" };
      refresh();
    });
    if (!passed) return Promise.resolve(submission);
    const { output } = passed;
    const ctx = { store, intent: undefined, input: value };
    return (running = (async (): Promise<Submission<undefined, R>> => {
      let next: Submission<undefined, R>;
      try {
        // The output is what the definition's `onSubmit` was typed for.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        next = { status: "succeeded", result: (await onSubmit?.(output as never, ctx as never)) as R };
      } catch (error) {
        next = { status: "failed", error };
      }
      if (run !== runs) return idle;
      running = undefined;
      submission = next;
      batch(refresh);
      return next;
    })());
  };

  const store: FormStore<V, E, undefined, R> = {
    id,
    subscribeForm: (listener) => listen(form, listener),
    getFormSnapshot: () => form.snapshot,
    getServerFormSnapshot: () => idleForm,
    peek: () => form.snapshot,
    batch,
    // With no intents, every submit's intent is undefined.
    submit: submit as (...args: IntentArgs<undefined>) => Promise<Submission<undefined, R>>,
    async handleSubmit(event) {
      event?.preventDefault();
      await submit();
    },
    setErrors: (errors: ErrorMap<E>) =>
      batch(() => {
        for (const field of fields.values()) field.user = none;
        if (errors.form !== undefined) fieldOf("").user = list(errors.form);
        for (const [name, entry] of Object.entries(errors.fields ?? {})) if (entry !== undefined) fieldOf(name).user = list(entry);
        refresh();
      }),
    // Mini has no baseline to move, so `to` makes no difference.
    reset: (_options?: ResetOptions) =>
      batch(() => {
        runs++;
        running = undefined;
        value = start;
        submitCount = 0;
        submission = idle;
        for (const field of fields.values()) {
          field.touched = false;
          field.found = field.user = none;
        }
        refresh();
      }),
    pathOf: split,
    fieldAt: (path) => fieldOf(path.join(".")).handle,
  };

  // Each part attaches at its path. What it writes there becomes the starting value.
  for (const part of options.parts ?? []) {
    const name = part.path ?? "";
    const path = split(name);
    part["~mini"]({
      path,
      value: () => read(value, path),
      at: (below) => fieldOf(name && below ? `${name}.${below}` : name || below).handle,
      write(fn) {
        const was = quiet;
        quiet = true;
        try {
          batch(fn);
        } finally {
          quiet = was;
        }
      },
      "~field": fieldOf(name),
      "~observe": (run) => observers.push([name, run]),
      "~start": (next) => {
        if (!Object.is(next, read(value, path))) value = write(value, path, next);
      },
    });
  }
  start = value;
  batch(refresh);
  return store;
}

/** The members of a definition that don't depend on where the value type comes from. */
export interface DefinitionOptions<V, O, E, R> {
  /** Validation for this form. Mini takes field validators only. */
  readonly validate?: { readonly fields?: FieldValidatorSet<V, E> };
  /**
   * Runs when a submit passes validation. `value` is the schema's output
   * when the form has a schema, and the form value otherwise.
   */
  readonly onSubmit?: (value: O, ctx: SubmitContext<V, E>) => R | Promise<R>;
}

/** What `onSubmit` gets besides the value. */
export interface SubmitContext<V, E = FormError, I = undefined> {
  /** The store being submitted. */
  readonly store: FormStore<V, E, I>;
  /** Always undefined: mini has no intents. */
  readonly intent: I;
  /** The form value as it was when validation passed, before the schema's transforms. */
  readonly input: DeepReadonly<V>;
}

/** The names a mini form binds: every `FieldPath` whose field isn't an object. */
export type LeafPath<V> = {
  [P in FieldPath<V>]: ShapeOf<ValueAtName<V, P>> extends "object" ? never : P;
}[FieldPath<V>];

/** The value type at dotted name `P` of `V`. */
export type ValueAtName<V, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? ValueAtName<ChildValue<V, Head>, Rest>
  : ChildValue<V, P>;

export type { FieldPath, Path };
