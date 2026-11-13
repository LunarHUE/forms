import type { HookPlugin } from "../../index.js";
import { definePlugin } from "../../plugins.js";

/** The part of `Storage` the fixture uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * A test fixture, not shipped. Saves the form value as JSON under `key` once
 * the page is idle, and writes a saved value back when the store is made.
 * Without storage, as on the server, it does nothing.
 */
export function persist(key: string, storage: StorageLike | undefined): HookPlugin<undefined, "persist"> {
  return definePlugin({
    name: "persist",
    setup(ctx) {
      if (!storage) return {};
      const { store } = ctx;
      const saved = storage.getItem(key);
      // A restore isn't a user edit, so the fields aren't marked edited.
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
