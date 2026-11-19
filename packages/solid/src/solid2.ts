// The Solid calls the adapter makes that differ between Solid 1 and Solid 2,
// for Solid 2. The adapter imports them from `#solid`, which package.json
// maps to this file, or to `solid1.ts` under the `@lunarhue/solid1`
// condition. The build compiles the adapter once with each, into `dist` and
// `dist/v1`, so each copy imports only its own Solid. Both files export the
// same names with the same types, and everything else the adapter imports
// from `solid-js` is the same in both majors.
import type { Context, Owner } from "solid-js";

export { isServer } from "@solidjs/web";
export { createMemo, createSignal, isHydrating, merge, omit } from "solid-js";
import { isDisposed } from "solid-js";

/** Returns a check that is true once `owner` is disposed. */
export const disposal = (owner: Owner): (() => boolean) => () => isDisposed(owner);

/** The component that provides `context`. In Solid 2 that is the context itself. */
export const providerOf = <T>(context: Context<T>) => context;

/** True when `children` is a render function. In Solid 2 no element is a function. */
export const isRenderFunction = <T>(children: T): children is Extract<T, (...args: never) => unknown> => typeof children === "function";

/**
 * Runs `fn`. Solid 2 already holds every write until the next flush, so the
 * DOM doesn't change under code that reads it right after a write.
 */
export const batch = <T>(fn: () => T): T => fn();

/**
 * Runs `fn` from a ref callback. Solid 2 sets a spread's props right after
 * its ref, in the same pass, so it runs `fn` at once.
 */
export const afterProps = (fn: () => void): void => fn();
