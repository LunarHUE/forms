/** One step in a path: an object key or an array index. */
export type PathSegment = string | number;

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
