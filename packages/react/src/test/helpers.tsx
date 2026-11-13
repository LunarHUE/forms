import { useEffect } from "react";
import type { AnyFormStore } from "../index.js";

/** Commit counts by component name, filled in by `useCommits`. */
export type Commits = Map<string, number>;

/**
 * Counts the commits of the calling component. It counts in an effect, which
 * runs once per committed render, so render itself stays pure for the Compiler.
 * StrictMode runs mount effects twice, so tests read counts after a reset.
 */
export function useCommits(commits: Commits, name: string): void {
  useEffect(() => {
    commits.set(name, (commits.get(name) ?? 0) + 1);
  });
}

/** Live listener counts of one store. */
export interface Listeners {
  fields: number;
  form: number;
}

const counted = new WeakMap<object, Listeners>();

/**
 * Wraps a store's `subscribe` and `subscribeForm` to count live listeners.
 * Call it before anything subscribes. Calling it twice returns the same counts.
 */
export function countListeners(store: AnyFormStore<unknown>): Listeners {
  const known = counted.get(store);
  if (known !== undefined) return known;
  const live: Listeners = { fields: 0, form: 0 };
  const subscribe = store.subscribe.bind(store);
  const subscribeForm = store.subscribeForm.bind(store);
  // The store is a plain object, so tests can wrap its methods.
  Object.assign(store, {
    subscribe(path: Parameters<typeof subscribe>[0], listener: () => void) {
      live.fields++;
      const stop = subscribe(path, listener);
      return () => {
        live.fields--;
        stop();
      };
    },
    subscribeForm(listener: () => void) {
      live.form++;
      const stop = subscribeForm(listener);
      return () => {
        live.form--;
        stop();
      };
    },
  });
  counted.set(store, live);
  return live;
}

/** Resolves after pending promise callbacks, such as a submit's, have run. */
export const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
