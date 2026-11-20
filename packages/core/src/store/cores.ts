import type { AnyFormStore } from "../store.js";
import type { StoreCore } from "./core.js";

/**
 * The value store under each form store, by form store. In a module of its
 * own so `invalidFields` and `subscribeInvalid` reach the core without the
 * store carrying them as members.
 */
export const cores: WeakMap<object, StoreCore<unknown, unknown>> = new WeakMap();

/** The core of a store `createFormStore` made. Its error type is the store's. */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
export const coreOf = <E>(store: AnyFormStore<E>) => cores.get(store) as StoreCore<E, unknown>;
