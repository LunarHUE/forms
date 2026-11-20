import type { Path, WriteCause } from "@lunarhue/forms-core";

/** The key the collector keeps a path's last write under. */
export const pathKey = (path: Path): string => JSON.stringify(path);

/** What kind of node a value is in the tree. Only plain objects and arrays have children. */
export function shapeOf(value: unknown): "array" | "object" | "leaf" {
  if (Array.isArray(value)) return "array";
  if (value === null || typeof value !== "object") return "leaf";
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null ? "object" : "leaf";
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** A value in one short line, as a tree row shows it. */
export function preview(value: unknown): string {
  if (typeof value === "string") return clip(JSON.stringify(value), 60);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "function") return "function";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  if (Array.isArray(value)) return value.length === 1 ? "1 row" : `${value.length} rows`;
  if (value !== null && typeof value === "object") {
    if (shapeOf(value) === "leaf") return value.constructor.name || "Object";
    const count = Object.keys(value).length;
    return count === 1 ? "1 field" : `${count} fields`;
  }
  return String(value);
}

/** A value in full, as the field detail shows it. */
export function format(value: unknown): string {
  if (value === undefined) return "undefined";
  const shape = shapeOf(value);
  if (shape === "leaf") return preview(value);
  try {
    const text = JSON.stringify(
      value,
      (_key, item: unknown) => (item === undefined || typeof item === "bigint" || typeof item === "function" ? preview(item) : item),
      2,
    );
    return clip(text, 4000);
  } catch {
    return preview(value);
  }
}

/** A write's cause as one word: `user`, `reset`, `rebase`, or the plugin's name. */
export const causeText = (cause: WriteCause): string => (typeof cause === "string" ? cause : cause.plugin);

const pad = (part: number) => String(part).padStart(2, "0");

/** The time of day a logged write or submission happened, to the second. */
export function clock(at: number): string {
  const time = new Date(at);
  return `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
}

/** Where the errors page lists each code, up to the anchor's package and code. */
export const errorsPage = "https://forms.lunarhue.dev/errors#";

/** An error as the panel shows it: its text, and the code and link when one of our packages raised it. */
export interface ShownError {
  /** The message, or the code when there is one. */
  readonly text: string;
  /** Such as `core:plugins:write`, the errors page's anchor. */
  readonly code?: string;
}

// A production message is the package and the code, `@lunarhue/forms-core: plugins:write`.
// A development one ends with the errors page's link, which has the anchor.
const productionCode = /^@lunarhue\/forms-([a-z]+): ([a-z]+:[a-z]+)/;
const linkedCode = /\/errors#([a-z]+:[a-z]+:[a-z]+)/;

/**
 * Reads an error of any type. A form's errors are whatever its validators
 * and `mapError` return, usually `{ message }`. An error our packages raised
 * shows as its code, linked to the errors page, since the sentence for it
 * exists only in development builds.
 */
export function readError(error: unknown): ShownError {
  const message =
    typeof error === "string"
      ? error
      : error !== null && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : format(error);
  const plain = productionCode.exec(message);
  const code = plain ? `${plain[1]}:${plain[2]}` : linkedCode.exec(message)?.[1];
  if (code !== undefined) return { text: code, code };
  return { text: message };
}
