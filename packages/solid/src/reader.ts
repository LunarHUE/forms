import type { FieldSnapshot, FormSnapshot, FormStore, Path } from "@lunarhue/forms-core";
import { isServer } from "@solidjs/web";
import { createSignal, getOwner, isHydrating, onCleanup } from "solid-js";

declare const process: { readonly env: { readonly NODE_ENV?: string } };

/**
 * Mirrors one store snapshot in one Solid signal, subscribed for the life of
 * the current owner. `read` gives the current snapshot, `serverRead` the one
 * the store started with, and `subscribe` calls its listener after a change
 * and returns the unsubscribe. With no owner it subscribes to nothing and returns a
 * reader of the current snapshot. On the server it reads the initial
 * snapshot, and while hydrating it starts from it and catches up once
 * hydration settles.
 *
 * Core calls listeners synchronously, and a write can come from a component
 * body or a computation, so the signal allows owned writes. Solid applies
 * the write at the next flush, a microtask later, before the browser paints.
 */
export function snapshotReader<S>(
  read: () => S,
  serverRead: () => S,
  subscribe: (listener: () => void) => () => void,
): () => S {
  if (isServer) return serverRead;
  if (getOwner() === null) return read;
  const hydrating = isHydrating();
  const initial = hydrating ? serverRead() : read();
  // Snapshots are frozen objects, never functions, so the plain-value form of `createSignal` applies.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const [snapshot, setSnapshot] = createSignal<S>(initial as Exclude<S, Function>, { ownedWrite: true });
  const sync = () => {
    const next = read();
    setSnapshot(() => next);
  };
  onCleanup(subscribe(sync));
  // A store written before hydration catches up once the hydration pass is over.
  // Not `onSettled`: it takes a hydration id, which the server never allocated.
  if (hydrating && initial !== read()) queueMicrotask(sync);
  return snapshot;
}

/** What a field reader needs from a handle. */
export interface ReadableHandle {
  readonly path: Path;
  readonly store: Pick<FormStore<unknown, unknown>, "subscribe" | "getSnapshot" | "getServerSnapshot">;
}

/** A reader of one field's snapshot. See `snapshotReader`. */
export function fieldReader(handle: ReadableHandle): () => FieldSnapshot<unknown, unknown> {
  const { store, path } = handle;
  return snapshotReader(
    () => store.getSnapshot(path),
    () => store.getServerSnapshot(path),
    (listener) => store.subscribe(path, listener),
  );
}

/** What a form reader needs from a store. */
export type FormSource<I, R> = Pick<FormStore<unknown, unknown, I, R>, "subscribeForm" | "getFormSnapshot" | "getServerFormSnapshot">;

/** A reader of the form snapshot. See `snapshotReader`. */
export function formReader<I, R>(store: FormSource<I, R>): () => FormSnapshot<I, R> {
  return snapshotReader(
    () => store.getFormSnapshot(),
    () => store.getServerFormSnapshot(),
    (listener) => store.subscribeForm(listener),
  );
}

/**
 * Adds an enumerable getter to `target` for each key, reading that member of
 * `read()`. It adds one for `meta` too, since a plugin can add `meta` to a
 * snapshot after the getters are made.
 */
export function defineGetters(target: object, keys: readonly string[], read: () => object): void {
  for (const key of new Set([...keys, "meta"])) {
    Object.defineProperty(target, key, {
      enumerable: true,
      get: (): unknown => Reflect.get(read(), key),
    });
  }
  // In development, a store without `dirty()` puts `dirty` on the snapshot's
  // prototype, as a getter that warns, so `keys` lacks it. This getter isn't
  // enumerable either, so spreading the object doesn't warn.
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production" && !keys.includes("dirty")) {
    Object.defineProperty(target, "dirty", { get: (): unknown => Reflect.get(read(), "dirty") });
  }
}
