import type { Branch } from "../handle.js";
import { childOf, isPlainObject } from "./tree.js";

/**
 * Returns `handle` when the snapshot's value is a plain object holding
 * `value` at `key`, by `Object.is`, and undefined otherwise. It reads nothing
 * but its arguments.
 */
export const branch: Branch = (handle, snapshot, key, value) =>
  // The check is what the narrowed type promises, which TypeScript can't follow.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  isPlainObject(snapshot.value) && Object.is(childOf(snapshot.value, key), value) ? (handle as never) : undefined;
