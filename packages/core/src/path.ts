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
