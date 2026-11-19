import type { Plugin } from "../plugin.js";
import { defineHooks } from "../store/define.js";
import { createTiming } from "../store/timing.js";

/** The part of `Storage` that `persist` uses. `localStorage` and `sessionStorage` fit. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// Core has no DOM types, so this declares the one global it reads.
declare const localStorage: StorageLike | undefined;

/**
 * Saves the form value as JSON in `storage` under `key` once the page is
 * idle after a write, and writes a saved value back when the store first
 * gets a listener, as when a component mounts a field. The server never
 * listens, so its render and the render that hydrates show the defaults.
 * The restored value isn't a user edit, so its fields aren't marked edited.
 *
 * `storage` defaults to `localStorage` where there is one. Without storage,
 * as on the server, it does nothing. Storage that throws, as when it is
 * blocked or full, never breaks the form, and a saved value that doesn't
 * parse is removed and the form starts from its defaults.
 */
export function persist(key: string, storage?: StorageLike): Plugin<undefined, "persist"> {
  return defineHooks({
    name: "persist",
    setup(ctx) {
      const { store } = ctx;
      let box: StorageLike | undefined;
      try {
        // Reading the `localStorage` global throws where storage is blocked.
        box = storage ?? (typeof localStorage === "undefined" ? undefined : localStorage);
      } catch {
        // Blocked storage. The form goes on without it.
      }
      const target = box;
      if (!target) return {};
      let restored = false;
      return {
        when: "idle",
        onWrite() {
          try {
            target.setItem(key, JSON.stringify(store.getSnapshot([]).value));
          } catch {
            // Full or blocked storage. The next write tries again.
          }
        },
        // Once per store: a store that loses its listeners and gets new ones keeps its value.
        onActive() {
          if (restored) return undefined;
          restored = true;
          try {
            const saved = target.getItem(key);
            if (saved != null) {
              const value: unknown = JSON.parse(saved);
              ctx.write(() => store.root.setValue(value, { replace: true, edited: false }));
            }
          } catch {
            try {
              target.removeItem(key);
            } catch {
              // Blocked storage. The form goes on without it.
            }
          }
          return undefined;
        },
      };
    },
  }, { "~timing": createTiming });
}
