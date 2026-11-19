// The Solid calls the adapter makes that differ between Solid 1 and Solid 2,
// for Solid 1. See `solid2.ts`, which exports the same names with the same types.
import {
  createEffect,
  createMemo as memo,
  createSignal as signal,
  getOwner,
  mergeProps,
  onCleanup,
  runWithOwner,
  sharedConfig,
  splitProps,
  untrack,
  type Accessor,
  type Context,
  type Owner,
  type Signal,
} from "solid-js";

export { isServer } from "solid-js/web";

/** What both majors take in a signal's options. Solid 1 has no owned-write check, so it ignores `ownedWrite`. */
interface SignalOptions<T> {
  readonly equals?: false | ((prev: T, next: T) => boolean);
  readonly ownedWrite?: boolean;
}

export const createSignal: <T>(value: T, options?: SignalOptions<T>) => Signal<T> = signal;

/** Solid 1 takes a memo's options third, after its initial value. */
export const createMemo = <T>(compute: () => T, options?: { readonly equals?: false | ((prev: T, next: T) => boolean) }): Accessor<T> =>
  memo(compute, undefined, options);

/** True while `hydrate` runs the component tree. */
export const isHydrating = (): boolean => sharedConfig.context != null;

export const merge = mergeProps;

/** `props` without `keys`, keeping the rest reactive. */
export const omit = <T extends object, K extends keyof T>(props: T, ...keys: K[]): { [P in keyof T as Exclude<P, K>]: T[P] } =>
  splitProps(props, keys)[1];

/** Returns a check that is true once `owner` is disposed. Solid 1 keeps no such flag, so a cleanup sets one. */
export function disposal(owner: Owner): () => boolean {
  let disposed = false;
  runWithOwner(owner, () =>
    onCleanup(() => {
      disposed = true;
    }),
  );
  return () => disposed;
}

/** The component that provides `context`. */
export const providerOf = <T>(context: Context<T>) => context.Provider;

/**
 * True when `children` is a render function. A Solid 1 component can return
 * a function, an accessor of what it renders, so only a function that takes
 * arguments counts, as Solid 1's `Show` decides.
 */
export const isRenderFunction = <T>(children: T): children is Extract<T, (...args: never) => unknown> =>
  typeof children === "function" && children.length > 0;

/**
 * Runs `fn` and holds its writes until it returns. Solid 1 applies a write
 * outside a batch at once, so a render effect would rewrite the DOM before
 * `fn` reads it.
 */
export { batch } from "solid-js";

/**
 * Runs `fn` from a ref once the element has its props. Solid 1 calls a
 * spread's ref before it sets the other props, so under an owner this waits
 * for the effects, which run after the render.
 */
export function afterProps(fn: () => void): void {
  if (getOwner() === null) fn();
  else createEffect(() => untrack(fn));
}
