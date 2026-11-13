import { hookPlugin } from "../hook-plugin.js";
import type { HookPlugin, WriteRecord } from "../plugin.js";
import { freeze } from "../store/freeze.js";
import { active } from "../store/host/active.js";
import { recorder } from "../store/host/recorder.js";
import { rebaseTo, type Resolve } from "../store/rebase.js";

/** What `bind` takes: a store the app owns, seen as one value. */
export interface BindOptions<T> {
  /** Returns the outside value now. */
  get(this: void): T;
  /**
   * Takes the form value after a batch of form writes, with that batch's
   * records. Writes the binding made itself don't come back here. With
   * `initial: "form"`, the first call sends the defaults with no records.
   */
  set(this: void, value: T, records: readonly WriteRecord[]): void;
  /** Calls `listener` when the outside value may have changed. Returns the function that unsubscribes. */
  subscribe(this: void, listener: () => void): () => void;
  /**
   * What an outside change does to the form. `"replace"`, the default,
   * writes the outside value over the form's. `"rebase"` moves the baseline
   * to it and keeps the leaves the user edited. A function picks per leaf,
   * as `rebase` does.
   */
  readonly incoming?: "replace" | "rebase" | Resolve;
  /**
   * Where the starting value comes from. `"outside"`, the default, starts
   * the form from `get()`: its value, its baseline and the server snapshot,
   * so a server render shows the outside value. `"form"` keeps the
   * form's defaults and sends them out with `set` when the form is first
   * listened to.
   */
  readonly initial?: "outside" | "form";
}

/** The plugin `bind` returns. `T` is the outside value's type. */
export interface BindPlugin<T> extends HookPlugin<undefined, "bind"> {
  /** Type information only, always undefined at runtime: lets a form check that its value type is `T`. */
  readonly "~value"?: (value: T) => T;
}

const edited: Resolve = (leaf) => (leaf.edited ? "keep" : "take");

/** Before the first sync, so no value equals it. */
const none = {};

/**
 * Keeps the form value in step with a store the app owns. The form keeps its
 * own store, with errors, flags and everything else. Only the value is
 * copied, both ways.
 *
 * A form write calls `set` once at the end of its batch. An outside change
 * is written into the form with `cause: { plugin: "bind" }`, so it isn't sent
 * back. The binding listens to the outside store only while the form store
 * has listeners, as it does while an adapter has its fields mounted, and
 * catches up with it when listening starts. A form has one binding.
 */
export function bind<T>(options: BindOptions<T>): BindPlugin<T> {
  const { get, set, subscribe, incoming = "replace", initial = "outside" } = options;
  const outside = initial === "outside";
  return hookPlugin([recorder, active], {
    name: "bind",
    // The store starts from the outside value, so the server renders it too.
    initial: () => (outside ? get() : undefined),
    setup(ctx) {
      const { store } = ctx;
      const current = () => store.getSnapshot([]).value;
      // The outside value and the form value as of the last sync.
      let seen: unknown = outside ? get() : none;
      let sent: unknown = outside ? current() : none;
      // True while `set` runs, so the outside store's own notice is ignored.
      let sending = false;

      const take = (value: unknown) => {
        seen = value;
        ctx.write(() => {
          if (incoming === "replace") store.root.setValue(() => value, { replace: true, edited: false });
          else rebaseTo(ctx, [], value, incoming === "rebase" ? edited : incoming);
          sent = current();
        });
      };

      const send = (records: readonly WriteRecord[]) => {
        const value = current();
        if (value === sent) return;
        sent = value;
        sending = true;
        try {
          // The form's value type is the outside one: `BindPlugin` lets the adapters check it.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          set(value as T, records);
        } finally {
          sending = false;
        }
        seen = get();
      };

      const listener = () => {
        if (sending) return;
        const value = get();
        if (value !== seen) take(value);
      };

      return {
        onWrite(records) {
          const mine = records.filter((record) => typeof record.cause !== "object" || record.cause.plugin !== "bind");
          if (mine.length > 0) send(freeze(mine));
        },
        onActive() {
          if (seen === none) send(freeze([]));
          else listener();
          return subscribe(listener);
        },
      };
    },
  });
}
