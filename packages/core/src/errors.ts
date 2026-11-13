import type { Path } from "./path.js";
import type { StandardSchemaV1 } from "./standard-schema.js";

/** The default error type. A form uses it unless `mapError` returns something else. */
export interface FormError {
  /** The text to show the user. */
  readonly message: string;
}

/** One value or a list of them. */
export type Many<T> = T | readonly T[];

/** A raw error made from a Standard Schema issue. */
export interface RawSchemaError {
  /** Where the error came from. */
  readonly source: "schema";
  /** The issue's message. */
  readonly message: string;
  /** The stable path of the field the error lands on. */
  readonly path: Path;
  /** The issue as the schema reported it. */
  readonly issue: StandardSchemaV1.Issue;
}

/** A raw error made from a value a validator threw. */
export interface RawThrownError {
  /** Where the error came from. */
  readonly source: "thrown";
  /** `cause.message` when the thrown value is an `Error`, else `String(cause)`. */
  readonly message: string;
  /** The stable path of the field the validator runs on. */
  readonly path: Path;
  /** The thrown value, untouched. */
  readonly cause: unknown;
}

/** What `mapError` receives. `source` says which of the two kinds it is. */
export type RawError = RawSchemaError | RawThrownError;

/**
 * Turns a raw error into the form's error type `E`. Core calls it for every
 * Standard Schema issue and for every validator that throws or rejects. An
 * error a validator returns is already an `E` and does not go through it.
 * Without `mapError`, `E` is `FormError` and core uses the raw `message`.
 */
export type MapError<E> = (raw: RawError) => E;

/**
 * Errors addressed by field. A form validator returns it and the store's
 * `setErrors` takes it.
 */
export interface ErrorMap<E> {
  /** Errors on the form as a whole. They show on the root field. */
  readonly form?: Many<E>;
  /**
   * Errors per field, keyed by the field's dotted name as in its snapshot's
   * `name` (`rows.0.title`). An undefined entry sets no errors there.
   */
  readonly fields?: Readonly<Record<string, Many<E> | undefined>>;
}

/**
 * When a field's errors appear in `shownErrors`. `"always"` shows them at
 * once. `"touched"` waits for the field to be touched. `"submitted"` waits
 * for the first submit. `"touched-or-submitted"` waits for either.
 */
export type ShowMode = "always" | "touched" | "submitted" | "touched-or-submitted";

/** What a `show` function knows when it decides. */
export interface ShowContext {
  /** True once the field has been blurred. */
  readonly touched: boolean;
  /** True once the field has had a user edit. */
  readonly edited: boolean;
  /** True when the field's value differs from its baseline. Always false without `dirty()`. */
  readonly dirty: boolean;
  /** How many submits the form has started. */
  readonly submitCount: number;
}

/**
 * When a field's errors appear in `shownErrors`: a named mode, or a function
 * that returns true to show them. Core calls the function again whenever an
 * input in its context changes.
 */
export type Show = ShowMode | ((ctx: ShowContext) => boolean);
