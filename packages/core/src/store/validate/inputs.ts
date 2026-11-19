import type { StandardSchemaV1 } from "../../standard-schema.js";
import type { ValidateTiming } from "../../validator.js";
import { isPlainObject } from "../tree.js";
import { item, type Pattern } from "./paths.js";

/** A check as validation runs it: a function, or a Standard Schema's `validate`. */
export type Check = (value: unknown, ctx: unknown) => unknown;

/** One validator input with its options taken apart. */
export interface Spec {
  /** A field validator returns errors for its field. A form validator returns an `ErrorMap`. */
  readonly kind: "field" | "form";
  /** True when the check is a Standard Schema, whose result holds issues. */
  readonly schema: boolean;
  readonly check: Check;
  readonly debounce: number;
  readonly on: ValidateTiming | undefined;
  readonly recheckOnSubmit: boolean;
}

/** True for an object or function with a `~standard` key. */
export const isSchema = (input: unknown): input is StandardSchemaV1 =>
  (typeof input === "object" || typeof input === "function") && input !== null && "~standard" in input;

/** True for an options object: something with a `validate` key that is not a schema. */
const isOptions = (input: unknown): input is { readonly validate: unknown } =>
  typeof input === "object" && input !== null && !isSchema(input) && "validate" in input;

interface OptionFields {
  readonly validate: unknown;
  readonly debounce?: unknown;
  readonly on?: unknown;
  readonly recheckOnSubmit?: unknown;
}

const timings: readonly unknown[] = ["input", "blur", "submit"];
const isTiming = (on: unknown): on is ValidateTiming => timings.includes(on);

/** Takes a validator, a schema or an options object wrapping either apart. Undefined for anything else. */
export function toSpec(input: unknown, kind: Spec["kind"]): Spec | undefined {
  const options: OptionFields = isOptions(input) ? input : { validate: input };
  const { validate } = options;
  let check: Check;
  const schema = isSchema(validate);
  if (schema) {
    const props = validate["~standard"];
    check = (value) => props.validate(value);
  } else if (typeof validate === "function") {
    // A validator of the matching kind. Validation calls it with a value and a context.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    check = validate as Check;
  } else return undefined;
  const debounce = typeof options.debounce === "number" && options.debounce > 0 ? options.debounce : 0;
  return {
    kind,
    schema,
    check,
    debounce,
    on: isTiming(options.on) ? options.on : undefined,
    recheckOnSubmit: options.recheckOnSubmit === true,
  };
}

/**
 * Reads a `validate.fields` declaration into one spec per pattern. A node
 * is a validator input when it is a function, a schema or an options
 * object. Otherwise a one-element array is the entry for every item and a
 * plain object holds child entries.
 *
 * An object with a `validate` key reads as an options object, so a record
 * for a value whose key is literally `validate` can't be written. Wrap that
 * key's entry in an options object one level up instead.
 */
export function readFields(decl: unknown, prefix: Pattern = [], out: { pattern: Pattern; spec: Spec }[] = []) {
  const spec = typeof decl === "function" || isSchema(decl) || isOptions(decl) ? toSpec(decl, "field") : undefined;
  if (spec) out.push({ pattern: prefix, spec });
  else if (Array.isArray(decl)) {
    if (decl.length > 0) readFields(decl[0], [...prefix, item], out);
  } else if (isPlainObject(decl)) for (const key of Object.keys(decl)) readFields(decl[key], [...prefix, key], out);
  return out;
}
