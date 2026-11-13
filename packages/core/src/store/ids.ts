import type { Path } from "../path.js";

const escape = (char: string) => `_${(char.codePointAt(0) ?? 0).toString(16)}_`;

/**
 * One path segment as an id fragment. Letters and digits pass through; every
 * other character becomes `_<hex>_`. `_` is always escaped, so an escape can't
 * be forged by a key, and a `-` is escaped at either end of the segment or next
 * to another `-`, so a segment never contains the `--` that joins segments.
 */
export function encodeSegment(segment: string | number): string {
  // Code points, not grapheme clusters: each one is escaped on its own.
  const chars = Array.from(String(segment));
  return chars
    .map((char, i) => {
      if (/^[A-Za-z0-9]$/.test(char)) return char;
      if (char === "-") {
        const edge = i === 0 || i === chars.length - 1;
        const doubled = chars[i - 1] === "-" || chars[i + 1] === "-";
        return edge || doubled ? escape(char) : char;
      }
      return escape(char);
    })
    .join("");
}

/** The id of the field at `path`: the form id and each encoded segment, joined with `--`. */
export function fieldId(formId: string, path: Path): string {
  return [formId, ...path.map(encodeSegment)].join("--");
}
