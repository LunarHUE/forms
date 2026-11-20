import type { AnyFormStore, PluginContext, Submission, WriteRecord } from "@lunarhue/forms-core";

// The contract between the collector (`devtools()`) and the panel. The
// collector writes it, the panel reads it. It lives on
// `globalThis[Symbol.for("lunarhue.forms.devtools")]`, so a panel or an
// extension can find it without importing this package. It is private: the
// package doesn't export these types, and `version` changes when a member
// changes meaning.

/** Where the hook lives on `globalThis`. */
export const hookKey: unique symbol = Symbol.for("lunarhue.forms.devtools");

/** The most writes and submissions a form keeps. Older ones drop off. */
export const logCap = 500;

/** A list that keeps the newest `cap` items. */
export interface Ring<T> {
  readonly cap: number;
  /** Oldest first. */
  readonly items: readonly T[];
  /** Adds `item` last, dropping the oldest when the ring is full. */
  push(item: T): void;
  clear(): void;
}

/** One committed write, as the form's `sync` `onWrite` got it. */
export interface LoggedWrite {
  /** From the form's counter, which writes and submissions share. */
  readonly seq: number;
  /** `Date.now()` when the write was logged. */
  readonly at: number;
  readonly record: WriteRecord;
}

/**
 * One submission. `"open"` until `onSubmitted` says how it ended, or
 * `"aborted"` when a reset of the whole form ended it first, which calls no
 * hook of its own.
 */
export interface LoggedSubmission {
  readonly seq: number;
  status: Submission<unknown>["status"] | "open" | "aborted";
}

/** A form store with `devtools()` installed that has listeners now. */
export interface FormEntry {
  readonly store: AnyFormStore<unknown>;
  /** The plugin context from the store's `setup`. */
  readonly ctx: PluginContext;
  /** The plugin's `enabled` option as a function. */
  readonly enabled: () => boolean;
  /** The plugin's `onDisable` option. The panel offers "Turn off devtools" when it is set. */
  readonly onDisable: (() => void) | undefined;
  /** `"react"`, `"solid"` and so on, from the first element event for this store. Undefined until one arrives. */
  adapter: string | undefined;
  /** Writes logged while the hook is on. Cleared when it goes off. */
  readonly writes: Ring<LoggedWrite>;
  /** The `seq` of the last write at each stable path, keyed by `JSON.stringify(path)`. */
  readonly lastWrite: Map<string, number>;
  /** Submissions started while the hook is on. Cleared when it goes off. */
  readonly submissions: Ring<LoggedSubmission>;
}

export interface Hook {
  readonly version: 1;
  /**
   * The registered forms, by a number unique on the page. A store registers
   * when it gets its first listener and leaves when it loses its last, so a
   * store a server render or a thrown-away render made never shows.
   */
  readonly forms: Map<number, FormEntry>;
  /** True while any entry's `enabled()` read true. The panel is mounted while it is. */
  on: boolean;
  /**
   * Reads every entry's `enabled()` now and turns the hook on or off. The
   * collector calls it on register and unregister, after each sync write
   * batch, and from `syncDevtools()`.
   */
  sync(): void;
  /** Calls `listener` when a form registers or leaves and when `on` changes. Returns the function that unsubscribes. */
  subscribe(listener: () => void): () => void;
  /** The connected elements a ref recorded for `key`: a field handle, or a store for its `<form>` element. */
  elementsOf(key: object): Element[];
  /** The field handle or store a ref recorded `element` for. */
  keyOf(element: Element): object | undefined;
}

/** Makes an empty ring that keeps the newest `cap` items. */
export function ring<T>(cap: number): Ring<T> {
  const items: T[] = [];
  return {
    cap,
    items,
    push(item) {
      items.push(item);
      if (items.length > cap) items.shift();
    },
    clear() {
      items.length = 0;
    },
  };
}
