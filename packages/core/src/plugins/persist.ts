import type { HookPlugin } from "../plugin.js";
import { definePlugin } from "../plugins.js";

/** The part of `Storage` that `persist` uses. `localStorage` and `sessionStorage` fit. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Saves the form value as JSON in `storage` under `key` once the page is
 * idle after a write, and writes a saved value back when the store is made.
 * The restored value isn't a user edit, so its fields aren't marked edited.
 * Without storage, as on the server, it does nothing.
 */
export function persist(key: string, storage: StorageLike | undefined): HookPlugin<undefined, "persist"> {
  return definePlugin({
    name: "persist",
    setup(ctx) {
      if (!storage) return {};
      const { store } = ctx;
      const saved = storage.getItem(key);
      if (saved !== null) ctx.write(() => store.root.setValue(JSON.parse(saved), { replace: true, edited: false }));
      return {
        when: "idle",
        onWrite() {
          storage.setItem(key, JSON.stringify(store.getSnapshot([]).value));
        },
      };
    },
  });
}
