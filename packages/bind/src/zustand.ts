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
  /** Turns a form value into the state to merge in, such as `(profile) => ({ profile })`. */
  update(value: T): Partial<S>;
}

/**
 * Binds the form value to a zustand store's whole state. A form write merges
 * the form value into the state with `setState`, so give the store no
 * actions, or bind a slice.
 */
export function zustand<S>(store: ZustandStore<S>, options?: ZustandOptions): BindPlugin<S>;
/**
 * Binds the form value to the slice of a zustand store's state that `select`
 * picks. A form write calls `setState(update(value))`. A store change whose
 * slice is the same reference doesn't reach the form.
 */
export function zustand<S, T>(store: ZustandStore<S>, options: ZustandSliceOptions<S, T>): BindPlugin<T>;
export function zustand<S, T>(
  store: ZustandStore<S>,
  options: ZustandOptions & Partial<ZustandSliceOptions<S, T>> = {},
): BindPlugin<S> | BindPlugin<T> {
  const { select, update, ...rest } = options;
  if (!select || !update) {
    return bind<S>({
      ...rest,
      get: () => store.getState(),
      set: (value) => store.setState(value),
      subscribe: (listener) => store.subscribe(listener),
    });
  }
  return bind<T>({
    ...rest,
    get: () => select(store.getState()),
    set: (value) => store.setState(update(value)),
    subscribe: (listener) =>
      store.subscribe((state, previous) => {
        if (select(state) !== select(previous)) listener();
      }),
  });
}
