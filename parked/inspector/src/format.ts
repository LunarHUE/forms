// Text formatting for the inspector's cells, lists and log. Pure functions,
// no DOM.
import type { Submission } from "@lunarhue/forms-core";

/** True for an object whose prototype is `Object.prototype` or null, as core treats plain objects. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Cuts `text` to `max` characters, ending with an ellipsis when it was longer. */
function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * A short form of a value for a table cell: leaves as JSON, arrays and
 * objects as a count, since their children have rows of their own.
 */
export function compactValue(value: unknown, max = 48): string {
  if (Array.isArray(value)) return `[${plural(value.length, "item")}]`;
  if (isPlainObject(value)) return `{${plural(Object.keys(value).length, "key")}}`;
  if (value === undefined) return "undefined";
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  return clip(compactJson(value, max), max);
}

/** Compact JSON for anything, with `undefined` and unserialisable values spelled out. */
export function compactJson(value: unknown, max = 160): string {
  if (value === undefined) return "undefined";
  if (value instanceof Error) return clip(`${value.name}: ${value.message}`, max);
  let text: string | undefined;
  try {
    text = JSON.stringify(value);
  } catch {
    text = undefined;
  }
  return clip(text ?? unserialisable(value), max);
}

/** A name for a value JSON can't represent: a symbol, a function, or an object with a cycle. */
function unserialisable(value: unknown): string {
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") return `function ${value.name}`.trim();
  return Object.prototype.toString.call(value);
}

/** One error as text: its `message` when it has one, else compact JSON. */
function errorText(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const message: unknown = Reflect.get(error, "message");
    if (typeof message === "string") return message;
  }
  return compactJson(error);
}

/** A list of errors as one line, or an empty string for none. */
export function formatErrors(errors: readonly unknown[]): string {
  return errors.map(errorText).join("; ");
}

/** A submission as its status, then the result, error or intent as compact JSON. */
export function formatSubmission(submission: Submission<unknown>): string {
  switch (submission.status) {
    case "succeeded":
      return `succeeded ${compactJson(submission.result)}`;
    case "failed":
      return `failed ${compactJson(submission.error)}`;
    case "submitting":
      return submission.intent === undefined ? "submitting" : `submitting ${compactJson(submission.intent)}`;
    default:
      return submission.status;
  }
}
