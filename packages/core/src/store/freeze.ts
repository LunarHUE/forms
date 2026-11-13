import type { Path } from "../path.js";
import { childOf, isContainer, isPlainObject } from "./tree.js";

// Core has no node types, so this declares the one global the check reads.
declare const process: { readonly env: { readonly NODE_ENV?: string } };

// Development is decided once at load, where `process.env.NODE_ENV` is read
// inside a try. A bundler replaces the read with a string. Without a bundler
// and without `process`, as in a browser loading the files directly, the read
// throws, and that counts as production: nothing is frozen.
const loadedInDev: boolean = /* @__PURE__ */ (() => {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
})();

// Every development check below is `loadedInDev && process.env.NODE_ENV !==
// "production"`. The first half stops the bare read from running where
// `process` is missing. At runtime the second half repeats the first. It is
// there for bundlers: they cannot see through the try, but they replace the
// bare read with "production", fold the check to false, and drop the branch.
// Keeping the check inside these three functions, rather than in an exported
// constant, is what lets that happen across module boundaries.

/** Freezes `value` in development and returns it. */
export function freeze<T extends object>(value: T): T {
  return loadedInDev && process.env.NODE_ENV !== "production" ? Object.freeze(value) : value;
}

/**
 * Freezes arrays and plain objects at every depth in development and returns
 * `value`. It stops at an object that is already frozen, so freezing a new
 * root after a write freezes only the nodes the write made. Leaves are never
 * frozen.
 */
export function deepFreeze<T>(value: T): T {
  if (loadedInDev && process.env.NODE_ENV !== "production") {
    // Declared inside the check so a bundler drops it with the branch.
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        if (Object.isFrozen(node)) return;
        Object.freeze(node);
        for (const item of node) walk(item);
      } else if (isPlainObject(node)) {
        if (Object.isFrozen(node)) return;
        Object.freeze(node);
        for (const key of Object.keys(node)) walk(node[key]);
      }
    };
    walk(value);
  }
  return value;
}

/**
 * In development, freezes the containers along value path `path` in `root`,
 * then deep-freezes the value at its end, and returns `root`. It is for a tree
 * `setAt` just made from a frozen one: the containers on the path are its new
 * copies and every other branch is shared, so the cost follows the path's
 * depth and the written value, not the number of siblings.
 */
export function freezePath<T>(root: T, path: Path): T {
  if (!(loadedInDev && process.env.NODE_ENV !== "production")) return root;
  let node: unknown = root;
  for (const key of path) {
    if (!isContainer(node)) return root;
    Object.freeze(node);
    node = childOf(node, key);
  }
  deepFreeze(node);
  return root;
}
