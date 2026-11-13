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

/**
 * The id of one radio, or one checkbox of a group, bound to the field `id`:
 * the field id, `---option-`, then the encoded option. A field id never
 * contains `---`, so this never equals a field id, a child's included. The
 * text after `---` starts with `option-`, so it never equals `errorId(id)`.
 */
export function optionId(id: string, option: string | number): string {
  return `${id}---option-${encodeSegment(option)}`;
}

/**
 * The id of the element that shows the errors of the field `id`: the field
 * id and `---error`. A field id never contains `---`, so this never equals a
 * field id, and it never equals an `optionId`, whose text after `---` starts
 * with `option-`.
 */
export function errorId(id: string): string {
  return `${id}---error`;
}
