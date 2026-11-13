import type { MapError } from "../errors.js";
import type { Path } from "../path.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import type { FieldValidators, FormValidatorInput, ValidateTiming, ValidatorInput } from "../validator.js";
import { problem } from "../problem.js";
import type { FormContext } from "./context.js";

/** The store options validation reads. */
export interface ValidationOptions<V, E> {
  /** The definition's validators and their timing. */
  readonly validate?: {
    /** When this form's validators first run. Overrides `timing`. */
    readonly on?: ValidateTiming;
    /** A validator for the whole value. */
    readonly form?: FormValidatorInput<V, E>;
    /** Field validators shaped like the value. */
    readonly fields?: FieldValidators<V, E>;
  } | undefined;
  /** A schema for the whole value. It runs as a form validator, before `validate.form` when both are given. */
  readonly schema?: StandardSchemaV1 | undefined;
  /** The shared timing from `createFormsCore`. Defaults to `"blur"`. */
  readonly timing?: ValidateTiming | undefined;
  /** Turns schema issues and thrown validators into errors. Without it an error is `{ message }`. */
  readonly mapError?: MapError<E> | undefined;
}

/** What the rest of the store asks of validation. The runner does the work. Without it, `noValidation` stands in. */
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
   * errors land. Without a schema both are the current value. Resolves
   * undefined when the value fails the schema.
   */
  schemaOutput(): Promise<SchemaOutput | undefined>;
}

/** A value that passed the form schema, and what the schema made of it. */
export interface SchemaOutput {
  readonly input: unknown;
  readonly output: unknown;
}

/**
 * Makes the validation of one store. The runner in
 * `@lunarhue/forms-core/plugins/validation` is one, and a plugin hands it to
 * the store. Internal.
 */
export type CreateValidation = <V, E, I, R>(context: FormContext<V, E, I, R>, options: ValidationOptions<V, E>) => Validation<E>;

const nothing = () => {};

/**
 * Stands in for the runner when no plugin brings it. A form with no
 * validators needs nothing more: `validate()` resolves valid, submit goes
 * straight to the value, and errors from `setErrors` work as they always do.
 * A definition with `validate` or `schema` throws when its store is made,
 * and adding a validator throws.
 */
export const noValidation: CreateValidation = (context, options) => {
  if (options.validate || options.schema) throw new Error(problem("validation:definition"));
  return {
    register() {
      throw new Error(problem("validation:validator"));
    },
    validate: async () => true,
    written: nothing,
    blurred: nothing,
    reset: nothing,
    changed: nothing,
    settleForSubmit: async () => {},
    async schemaOutput() {
      const value = context.core.getSnapshot([]).value;
      return { input: value, output: value };
    },
  };
};
