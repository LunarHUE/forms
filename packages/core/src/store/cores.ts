import type { StoreCore } from "./core.js";

/**
 * The value store under each form store, by form store. In a module of its
 * own so `invalidFields` and `subscribeInvalid` reach the core without the
 * store carrying them as members.
 */
export const cores: WeakMap<object, StoreCore<unknown, unknown>> = new WeakMap();
