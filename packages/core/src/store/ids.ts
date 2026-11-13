import type { Path } from "../path.js";

const escape = (char: string) => `_${(char.codePointAt(0) ?? 0).toString(16)}_`;

/**
 * One path segment as an id fragment. Letters and digits pass through; every
 * other character becomes `_<hex>_`. `_` is always escaped, so an escape can't
 * be forged by a key, and a `-` is escaped at either end of the segment or next
 * to another `-`, so a segment never contains the `--` that joins segments.
 */
export function encodeSegment(segment: string | number): string {
  // Matches anything but a letter, digit or `-`, then a `-` at either end or
  // next to another `-`. With `u` a match is a code point, not a grapheme
  // cluster, so each one is escaped on its own.
  return String(segment).replace(/[^A-Za-z0-9-]|^-|-$|-(?=-)|(?<=-)-/gu, escape);
}

/** The id of the field at `path`: the form id and each encoded segment, joined with `--`. */
export function fieldId(formId: string, path: Path): string {
  return [formId, ...path.map(encodeSegment)].join("--");
}
