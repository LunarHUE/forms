import type { Path } from "../path.js";
import type { ValidatorInput } from "../validator.js";
import type { FormContext } from "./context.js";

/** The store options validation reads. There are none until the validators arrive. */
// The type parameters are for the options validators bring.
// oxlint-disable-next-line no-unused-vars
export interface ValidationOptions<V, E> {}

/** Field and form validators, their timing, debounce and async runs. */
export interface Validation<E> {
  /** Adds a validator at stable path `path`. The returned function removes it and the errors it set. */
  register(path: Path, validator: ValidatorInput<unknown, E>): () => void;
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
  /** Runs what submit needs and resolves once no validator is running. */
  settleForSubmit(): Promise<void>;
}

const noop = () => {};

/**
 * Makes validation. This is a placeholder: no validator runs, and
 * `validate` reports the validation errors already in the store.
 */
export function createValidation<V, E, I, R>(
  context: FormContext<V, E, I, R>,
  // oxlint-disable-next-line typescript/no-generated-empty-object-type
  _options: ValidationOptions<V, E>,
): Validation<E> {
  const { core } = context;
  return {
    register: () => noop,
    validate: (path) => Promise.resolve(!core.invalidAt(path)),
    written: noop,
    blurred: noop,
    reset: noop,
    settleForSubmit: () => Promise.resolve(),
  };
}
