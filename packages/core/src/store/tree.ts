import type { Path, PathSegment } from "../path.js";

/** True when `key` is an own property of `object`. Inherited names such as `constructor` don't count. */
export function hasOwn(object: object, key: PathSegment): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/** True for a plain object: one whose prototype is `Object.prototype` or `null`. Arrays are not plain objects. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * True for the values the store looks inside: arrays and plain objects.
 * Everything else is a leaf, including Date, Map, Set, Blob and class
 * instances.
 */
export function isContainer(value: unknown): value is object {
  return Array.isArray(value) || isPlainObject(value);
}

/** The own property `key` of `container`, or undefined. */
export function childOf(container: object, key: PathSegment): unknown {
  return hasOwn(container, key) ? Reflect.get(container, key) : undefined;
}

/** The value at value path `path` in `root`, or undefined when a step is missing or is a leaf. */
export function valueAt(root: unknown, path: Path): unknown {
  let node = root;
  for (const key of path) {
    if (!isContainer(node)) return undefined;
    node = childOf(node, key);
  }
  return node;
}

function copyOf(node: object): object {
  if (Array.isArray(node)) return node.slice();
  // Spread defines own properties, so an own `__proto__` key stays a key.
  if (Object.getPrototypeOf(node) !== null) return { ...node };
  const bare: object = Object.create(null);
  return Object.assign(bare, node);
}

/**
 * A copy of `root` with `value` at value path `path`, sharing every untouched
 * branch. A step that is missing or a leaf becomes a new array for a number
 * key and a new object for a string key.
 */
export function setAt(root: unknown, path: Path, value: unknown): unknown {
  const key = path[0];
  if (key === undefined) return value;
  const node = isContainer(root) ? root : typeof key === "number" ? [] : {};
  const copy = copyOf(node);
  // A define, not an assignment, so a `__proto__` key can't change the copy's prototype.
  Object.defineProperty(copy, key, {
    value: setAt(childOf(node, key), path.slice(1), value),
    writable: true,
    enumerable: true,
    configurable: true,
  });
  return copy;
}

/** The leaf value paths where `a` and `b` differ, stopping at shared references. */
export function changedPaths(a: unknown, b: unknown, path: Path = []): Path[] {
  if (Object.is(a, b)) return [];
  if (!isContainer(a) || !isContainer(b) || Array.isArray(a) !== Array.isArray(b)) return [path];
  // An array that changed length is one change: its items move together.
  if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) return [path];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].flatMap((key) =>
    changedPaths(childOf(a, key), childOf(b, key), [...path, Array.isArray(a) ? Number(key) : key]),
  );
}
