import { isPlainObject } from "./tree.js";

// Core has no node types, so this declares the one global the check reads.
declare const process: { readonly env: { readonly NODE_ENV?: string } };

/**
 * True outside production builds. A bundler replaces `process.env.NODE_ENV`
 * with a string. Where `process` doesn't exist the read throws, and that
 * counts as development.
 */
export const dev: boolean = /* @__PURE__ */ (() => {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return true;
  }
})();

/**
 * Freezes arrays and plain objects at every depth and returns `value`. It
 * stops at an object that is already frozen, so freezing a new root after a
 * write freezes only the nodes the write made. Leaves are never frozen.
 */
export function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    if (Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const item of value) deepFreeze(item);
  } else if (isPlainObject(value)) {
    if (Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}
