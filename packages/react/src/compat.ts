import * as React from "react";

// The hooks that differ between React versions. Every module calls them
// through `hooks`, which holds React 18's own. The legacy entry replaces them
// once, at load, with ones that also work on React 16.8 and 17.

/** `useSyncExternalStore` as the adapter calls it. */
export type UseSyncExternalStore = <S>(
  subscribe: (onChange: () => void) => () => void,
  getSnapshot: () => S,
  getServerSnapshot?: () => S,
) => S;

/** The version-specific hooks. */
export interface Hooks {
  useSyncExternalStore: UseSyncExternalStore;
  useId: () => string;
  /** Called when a form takes its id from `useId`. */
  generatedIdUsed?: () => void;
}

/** The hooks React 18 added, which React 16.8 and 17 lack. */
export type Added = Partial<Pick<typeof React, "useId" | "useSyncExternalStore">>;

const added: Added = React;

/**
 * Reads a hook React may lack. The name is a parameter, not a property
 * written in the source, so a bundler can't check it against React's exports
 * and fail the build on React 17.
 */
export const optional = <K extends keyof Added>(name: K): Added[K] => added[name];

const missing = (): never => {
  throw new Error("@lunarhue/forms-react: React before 18 needs @lunarhue/forms-react/legacy.");
};

export const hooks: Hooks = {
  useSyncExternalStore: optional("useSyncExternalStore") ?? missing,
  useId: optional("useId") ?? missing,
};
