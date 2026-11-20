// React's own hooks, the default build. An app on React 16.8 or 17 sets the
// `@lunarhue/react-legacy` condition, and `#lunarhue/react` resolves to
// `legacy.ts` instead, which exports the same names with fallbacks.
import * as React from "react";
import type { UseSyncExternalStore } from "./legacy.js";
import { problem } from "./problem.js";

// The package has no node types, so this declares the one global the check reads.
declare const process: { readonly env: { readonly NODE_ENV?: string } };

// Read through a loosely typed object, not as named imports, so on React 17
// the app fails with this module's error and not the bundler's missing export.
const hooks: Partial<Pick<typeof React, "useId" | "useSyncExternalStore">> = React;

if (typeof process !== "undefined" && process.env.NODE_ENV !== "production" && !hooks.useSyncExternalStore) {
  throw new Error(problem("react:legacy"));
}

// oxlint-disable-next-line typescript/no-unsafe-type-assertion
export const useSyncExternalStore = hooks.useSyncExternalStore as UseSyncExternalStore;

// oxlint-disable-next-line typescript/no-unsafe-type-assertion
export const useId = hooks.useId as () => string;

/** React 18 ids match between server and client, so there is nothing to warn about. */
export function generatedIdUsed(): void {}
