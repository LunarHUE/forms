import type { Path } from "../../path.js";

/** The pattern segment that matches any item of an array. */
export const item: unique symbol = Symbol("item");

/** A stable path where a segment can be `item`, for validators declared over every array item. */
export type Pattern = readonly (string | typeof item)[];

export { keyOf } from "../placed.js";

/** True when `path` starts with `prefix`. */
export const startsWith = (path: Path, prefix: Path): boolean =>
  prefix.length <= path.length && prefix.every((seg, i) => String(seg) === String(path[i]));

/** True when the first `length` segments of `path` match `pattern`, which must be at least that long. */
export const matches = (pattern: Pattern, path: Path, length: number): boolean => {
  for (let i = 0; i < length; i++) {
    const seg = pattern[i];
    if (seg !== item && seg !== String(path[i])) return false;
  }
  return true;
};

/** True when the pattern has no `item` segment, so it names one field. */
export const isConcrete = (pattern: Pattern): pattern is readonly string[] => !pattern.includes(item);
