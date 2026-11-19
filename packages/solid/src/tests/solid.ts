// The Solid calls the tests make that differ between Solid 1 and Solid 2,
// for Solid 2. The Solid 1 projects (vitest.solid1.ts) swap in solid1.ts,
// which exports the same names.
import { createEffect as effect } from "solid-js";

export { hydrate, render, renderToString } from "@solidjs/web";
export { Errored, flush } from "solid-js";

/** The Solid major the tests run on. */
export const major: 1 | 2 = 2;

/** The Solid version the tests run on, as markup that differs by version looks it up. */
export const version: "1.8" | "1.9" | "2" = "2";

/** An effect that reads in `compute` and acts in `apply`, as Solid 2 splits them. */
export function createEffect<T>(compute: () => T, apply: (value: T) => void): void {
  effect(compute, apply);
}
