import type { ChildValue, KeysOf, ShapeOf } from "./value.js";

/**
 * One step in a path. In a stable path it is an object key, or an array
 * item's stable key in place of its index. In a dotted path it is an object
 * key or an array index.
 */
export type PathSegment = string | number;

/**
 * A path into a form value, as segments. Handles and the store address fields
 * by stable path: property names for objects, and the item's stable key (a
 * string) for array items. A stable path keeps pointing at the same item
 * when the array is reordered.
 */
export type Path = readonly PathSegment[];

/**
 * Splits a path into segments. Digit-only segments become numbers.
 *
 * `splitPath("items.0.name")` returns `["items", 0, "name"]`.
 */
export function splitPath(path: string, separator?: string): readonly PathSegment[] {
  separator ??= ".";
  if (path === "") return [];
  return path.split(separator).map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

/** How many segments a field name can have. Deeper fields are reached with a handle. */
export type PathMaxDepth = 8;

/**
 * The dotted names of the fields in a value of type `V`, such as
 * `"address.city"`. A name goes through plain objects only: it has no array
 * indexes, and it stops at an array, so the array field itself has a name
 * but its items don't. A name has at most `PathMaxDepth` segments.
 */
export type FieldPath<V> = PathsOf<V, []>;

/** The names of `FieldPath<V>` at depth `D["length"]` and below. */
type PathsOf<V, D extends readonly unknown[]> = D["length"] extends PathMaxDepth
  ? never
  : {
      [K in KeysOf<V>]: `${K}` | (ShapeOf<ChildValue<V, K>> extends "object" ? `${K}.${PathsOf<ChildValue<V, K>, [...D, 0]>}` : never);
    }[KeysOf<V>];
