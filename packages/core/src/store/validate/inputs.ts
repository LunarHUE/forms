import type { Path } from "../../path.js";
import type { StandardSchemaV1 } from "../../standard-schema.js";
import type { ValidateTiming } from "../../validator.js";
import { isPlainObject } from "../tree.js";
import { item, type Pattern } from "./paths.js";

/** A check as validation runs it: a function, or a Standard Schema's `validate`. */
export type Check = (value: unknown, ctx: unknown) => unknown;

/** One validator input with its timing tags read. */
export interface Spec {
  /** A field validator returns errors for its field. A form validator returns an `ErrorMap`. */
  readonly kind: "field" | "form";
  /** True when the check is a Standard Schema, whose result holds issues. */
  readonly schema: boolean;
  readonly check: Check;
  /** Places a result that isn't a field's own errors. `formValidator` gives the one for an `ErrorMap`. */
  readonly place?: (placed: never, core: never, base: Path, result: unknown) => void;
  readonly on: ValidateTiming | undefined;
  readonly recheckOnSubmit: boolean;
}

/** Internal: `validation.ts` attaches a step callback on `ctx` for `pipe()`. */
export const stepSlot = Symbol();

/** Reports a `pipe()` step outcome to the validation runner. */
export type StepHook = (index: number, failed: boolean) => void;

/** What `debounced`, `validateOn` and `recheckOnSubmit` put on the function they return. */
export interface Tags {
  /** Set by `validateOn`. */
  readonly "~on"?: ValidateTiming;
  /** Set by `recheckOnSubmit`. */
  readonly "~recheck"?: boolean;
  /**
   * True when the function runs a Standard Schema and returns its result. On
   * a result, `pipe` sets it to say a schema check returned it.
   */
  readonly "~schema"?: boolean;
}

// A primitive's `then` comes from its prototype, which nothing sets.
export const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  typeof (value as { then?: unknown } | null | undefined)?.then === "function";

/** True for an object or function with a `~standard` key. */
export const isSchema = (input: unknown): input is StandardSchemaV1 =>
  (typeof input === "object" || typeof input === "function") && input !== null && "~standard" in input;

/** Takes a validator, a schema or a wrapped check apart. Undefined for anything else. */
export function toSpec(validate: unknown, kind: Spec["kind"]): Spec | undefined {
  // A schema that is also a function, as some libraries make them, reads as a schema.
  if (isSchema(validate)) {
    const props = validate["~standard"];
    return { kind, schema: true, check: (value) => props.validate(value), on: undefined, recheckOnSubmit: false };
  }
  if (typeof validate !== "function") return undefined;
  // A validator of the matching kind, maybe wrapped. Validation calls it with a value and a context.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const tags = validate as Tags;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return { kind, schema: !!tags["~schema"], check: validate as Check, on: tags["~on"], recheckOnSubmit: !!tags["~recheck"] };
}

/**
 * Reads a `validate.fields` declaration into one spec per pattern. A node
 * is a validator input when it is a function or a schema. Otherwise a
 * one-element array is the entry for every item and a plain object holds
 * child entries.
 */
export function readFields(decl: unknown, prefix: Pattern = [], out: { pattern: Pattern; spec: Spec }[] = []) {
  const spec = toSpec(decl, "field");
  if (spec) out.push({ pattern: prefix, spec });
  else if (Array.isArray(decl)) {
    if (decl.length > 0) readFields(decl[0], [...prefix, item], out);
  } else if (isPlainObject(decl)) for (const key of Object.keys(decl)) readFields(decl[key], [...prefix, key], out);
  return out;
}
