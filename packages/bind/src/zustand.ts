import { bind, type BindOptions, type BindPlugin } from "@lunarhue/forms-core/plugins";

// The declarations bundle core's types, so a consumer's emitted declarations
// can name the type zustand() returns only through this entry.
export type { BindPlugin };

/**
 * The part of a zustand store the binding uses. The hook `create` returns
 * fits, and so does a vanilla store from `createStore`.
 */
export interface ZustandStore<S> {
  getState(): S;
  setState(partial: Partial<S>): void;
  subscribe(listener: (state: S, previous: S) => void): () => void;
}

/** What every `zustand` call takes: `bind`'s `incoming` and `initial`. */
export type ZustandOptions = Pick<BindOptions<unknown>, "incoming" | "initial">;

/** Binds the form to one slice of the store's state. */
export interface ZustandSliceOptions<S, T> extends ZustandOptions {
  /** Picks the slice that is the form value. */
  select(state: S): T;
  /**
   * Turns a form value into the state to merge in, such as
   * `(profile) => ({ profile })`. `state` is the store's state before the
   * write, for a slice that sits inside a bigger object, such as one key of
   * a map.
   */
  update(value: T, state: S): Partial<S>;
  /**
   * Whether two slices are the same, `Object.is` by default. Pass one when
   * `select` builds a new object each time, such as `{ verdict, body }`, so
   * a store change that leaves those fields alone doesn't reach the form.
   */
  readonly isEqual?: (previous: T, next: T) => boolean;
}

/**
 * Binds the form value to a zustand store's whole state. A form write merges
 * the form value into the state with `setState`, so give the store no
 * actions, or bind a slice.
 */
export function zustand<S>(store: ZustandStore<S>, options?: ZustandOptions): BindPlugin<S>;
/**
 * Binds the form value to the slice of a zustand store's state that `select`
 * picks. A form write calls `setState(update(value, state))`. A store change
 * whose slice `isEqual` finds the same doesn't reach the form.
 */
export function zustand<S, T>(store: ZustandStore<S>, options: ZustandSliceOptions<S, T>): BindPlugin<T>;
export function zustand<S>(
  store: ZustandStore<S>,
  {
    select = (state) => state,
    update = (value) => value,
    isEqual = Object.is,
    ...rest
  }: ZustandOptions & Partial<ZustandSliceOptions<S, S>> = {},
): BindPlugin<S> {
  // The slice `get` last returned. `bind` compares slices by reference, so an
  // equal slice hands back this one and doesn't count as a change.
  let last = select(store.getState());
  return bind<S>({
    ...rest,
    get() {
      const next = select(store.getState());
      return isEqual(last, next) ? last : (last = next);
    },
    set: (value) => store.setState(update(value, store.getState())),
    subscribe: (listener) => store.subscribe(listener),
  });
}
