// The Solid calls the tests make that differ between Solid 1 and Solid 2,
// for Solid 1. See solid.ts, which exports the same names for Solid 2.
import { createComponent, createEffect as effect, ErrorBoundary, sharedConfig, untrack, type Accessor, type JSX } from "solid-js";
import { hydrate as solidHydrate } from "solid-js/web";
import { inject } from "vitest";

declare module "vitest" {
  interface ProvidedContext {
    /** The Solid 1 version a project runs on, from vitest.solid1.ts. */
    solid1: "1.8" | "1.9";
  }
}

export { render, renderToString } from "solid-js/web";

/**
 * Solid's `hydrate`, as on a fresh page. Solid 1.9 marks hydration done on
 * the first delegated event and keeps that for the module's life, so a later
 * test's `hydrate` would render new nodes instead of adopting the markup.
 */
export const hydrate: typeof solidHydrate = (code, element, options) => {
  Object.assign(sharedConfig, { done: false });
  return solidHydrate(code, element, options);
};

/** The Solid major the tests run on. */
export const major: 1 | 2 = 1;

/** The Solid version the tests run on, as markup that differs by version looks it up. */
export const version: "1.8" | "1.9" | "2" = inject("solid1");

/** Solid 1 runs effects when the update that queued them ends, so there is nothing left to flush. */
export function flush(): void {}

/** Solid 2's `Errored` on Solid 1's `ErrorBoundary`: the fallback gets the error as an accessor. */
export function Errored(props: { readonly fallback: (error: Accessor<unknown>) => JSX.Element; readonly children: JSX.Element }): JSX.Element {
  return createComponent(ErrorBoundary, {
    fallback: (error: unknown) => props.fallback(() => error),
    get children() {
      return props.children;
    },
  });
}

/** An effect that reads in `compute` and acts in `apply`. Solid 1 runs both in one effect, `apply` untracked. */
export function createEffect<T>(compute: () => T, apply: (value: T) => void): void {
  effect(() => {
    const value = compute();
    untrack(() => apply(value));
  });
}
