import type { HookPlugin } from "../plugin.js";
import { definePlugin } from "../plugins.js";

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
 * idle after a write, and writes a saved value back when the store is made.
 * The restored value isn't a user edit, so its fields aren't marked edited.
 *
 * `storage` defaults to `localStorage` where there is one. Without storage,
 * as on the server, it does nothing. Storage that throws, as when it is
 * blocked or full, never breaks the form, and a saved value that doesn't
 * parse is removed and the form starts from its defaults.
 */
export function persist(key: string, storage?: StorageLike): HookPlugin<undefined, "persist"> {
  return definePlugin({
    name: "persist",
    setup(ctx) {
      const { store } = ctx;
      let box: StorageLike | undefined;
      try {
        // Reading the `localStorage` global throws where storage is blocked.
        box = storage ?? (typeof localStorage === "undefined" ? undefined : localStorage);
        const saved = box?.getItem(key);
        if (saved != null) {
          const value: unknown = JSON.parse(saved);
          ctx.write(() => store.root.setValue(value, { replace: true, edited: false }));
        }
      } catch {
        try {
          box?.removeItem(key);
        } catch {
          // Blocked storage. The form goes on without it.
        }
      }
      const target = box;
      if (!target) return {};
      return {
        when: "idle",
        onWrite() {
          try {
            target.setItem(key, JSON.stringify(store.getSnapshot([]).value));
          } catch {
            // Full or blocked storage. The next write tries again.
          }
        },
      };
    },
  });
}
