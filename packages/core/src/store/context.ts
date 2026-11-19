import type { StoreCore } from "./core.js";
import type { MadeStore } from "./form-store.js";

/** What the modules behind a form store share. */
export interface FormContext<V, E, I, R> {
  /** The value store. */
  readonly core: StoreCore<E, I, R>;
  /**
   * The public store. It exists once `createFormStore` returns, so call this
   * inside commands, not while a module is being made.
   */
  readonly store: () => MadeStore<V, E, I, R>;
}
