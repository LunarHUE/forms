import type { MapError } from "../errors.js";
import type { Path } from "../path.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import type { FieldValidatorSet, FormValidatorSet, ValidateTiming, ValidatorInput } from "../validator.js";

/** The store options validation reads. */
export interface ValidationOptions<V, E> {
  /** The definition's validators and their timing. */
  readonly validate?: {
    /** A validator for the whole value. */
    readonly form?: FormValidatorSet<V, E>;
    /** Field validators shaped like the value. */
    readonly fields?: FieldValidatorSet<V, E>;
  } | undefined;
  /** A schema for the whole value. It runs as a form validator, before `validate.form` when both are given. */
  readonly schema?: StandardSchemaV1 | undefined;
  /** The shared timing from `createFormsCore`. Defaults to `"blur"`. */
  readonly timing?: ValidateTiming | undefined;
  /** Turns schema issues and thrown validators into errors. Without it an error is `{ message }`. */
  readonly mapError?: MapError<E> | undefined;
}

/** What the rest of the store asks of validation. `createValidation` in `validation.ts` does the work. */
export interface Validation<E> {
  /** Adds a validator at stable path `path`. The returned function removes it and the errors it set. */
  register(this: void, path: Path, validator: ValidatorInput<unknown, E>): () => void;
  /** Runs every validator at and below `path` now. Resolves true when the subtree has no validation error. */
  validate(path: Path): Promise<boolean>;
  /** Called after a user-edit write at `path` changed the value, inside the write's batch. */
  written(path: Path): void;
  /** Called after the field at `path` was blurred, inside the blur's batch. */
  blurred(path: Path): void;
  /**
   * Called when the subtree at `path` is reset, inside the reset's batch and
   * before the baseline writes, to abort runs and drop pending debounces there.
   */
  reset(path: Path): void;
  /**
   * Called after writes that were not user edits changed the values at
   * `paths`, inside their batch. Reruns the validators that already run on
   * input and touch those paths. It arms nothing. In a store with hook
   * plugins the host gathers the paths of one batch and calls it once at
   * the end, so each validator reruns once for the whole batch.
   */
  changed(paths: readonly Path[]): void;
  /** Runs what submit needs and resolves once no validator is running. */
  settleForSubmit(): Promise<void>;
  /**
   * The value submit passes on and what `onSubmit` gets for it. With a form
   * schema that is the schema's output, from its last run when that run
   * passed on the current value. Otherwise the schema runs again now and its
   * errors land. Without a schema the input is the current value and the
   * output a copy of it that `onSubmit` may change. Resolves
   * undefined when the value fails the schema.
   */
  schemaOutput(): Promise<SchemaOutput | undefined>;
}

/** A value that passed the form schema, and what the schema made of it. */
export interface SchemaOutput {
  readonly input: unknown;
  readonly output: unknown;
}
