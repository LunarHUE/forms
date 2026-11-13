import type { FieldSnapshot, FormSnapshot, FormStore, Path } from "@lunarhue/forms-core";
import { isServer } from "@solidjs/web";
import { createSignal, getOwner, isHydrating, onCleanup } from "solid-js";

/** What a reader needs from a store snapshot source. */
interface SnapshotSource<S> {
  /** The current snapshot. */
  readonly read: () => S;
  /** The snapshot the store started with. */
  readonly serverRead: () => S;
  /** Calls the listener after the snapshot changes. Returns the unsubscribe. */
  readonly subscribe: (listener: () => void) => () => void;
}

/**
 * Mirrors one store snapshot in one Solid signal, subscribed for the life of
 * the current owner. With no owner it subscribes to nothing and returns a
 * reader of the current snapshot. On the server it reads the initial
 * snapshot, and while hydrating it starts from it and catches up once
 * hydration settles.
 *
 * Core calls listeners synchronously, and a write can come from a component
 * body or a computation, so the signal allows owned writes. Solid applies
 * the write at the next flush, a microtask later, before the browser paints.
 */
export function snapshotReader<S>(source: SnapshotSource<S>): () => S {
  if (isServer) return source.serverRead;
  if (getOwner() === null) return source.read;
  const hydrating = isHydrating();
  const initial = hydrating ? source.serverRead() : source.read();
  // Snapshots are frozen objects, never functions, so the plain-value form of `createSignal` applies.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const [snapshot, setSnapshot] = createSignal<S>(initial as Exclude<S, Function>, { ownedWrite: true });
  const sync = () => {
    const next = source.read();
    setSnapshot(() => next);
  };
  onCleanup(source.subscribe(sync));
  // A store written before hydration catches up once the hydration pass is over.
  // Not `onSettled`: it takes a hydration id, which the server never allocated.
  if (hydrating && initial !== source.read()) queueMicrotask(sync);
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
  return snapshotReader({
    read: () => store.getSnapshot(path),
    serverRead: () => store.getServerSnapshot(path),
    subscribe: (listener) => store.subscribe(path, listener),
  });
}

/** What a form reader needs from a store. */
export type FormSource<I, R> = Pick<FormStore<unknown, unknown, I, R>, "subscribeForm" | "getFormSnapshot" | "getServerFormSnapshot">;

/** A reader of the form snapshot. See `snapshotReader`. */
export function formReader<I, R>(store: FormSource<I, R>): () => FormSnapshot<I, R> {
  return snapshotReader({
    read: () => store.getFormSnapshot(),
    serverRead: () => store.getServerFormSnapshot(),
    subscribe: (listener) => store.subscribeForm(listener),
  });
}

/** Adds an enumerable getter to `target` for each key, reading that member of `read()`. */
export function defineGetters(target: object, keys: readonly string[], read: () => object): void {
  for (const key of keys) {
    Object.defineProperty(target, key, {
      enumerable: true,
      get: (): unknown => Reflect.get(read(), key),
    });
  }
}
