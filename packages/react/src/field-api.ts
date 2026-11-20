import type { FieldSnapshot } from "@lunarhue/forms-core";
import type { HandleLike } from "./field.js";
import { errorId } from "./input.js";
import { piecesFor, textOf } from "./pieces.js";
import { cached, type Source } from "./select.js";
import { fieldSource } from "./sources.js";

/** A field object as the runtime builds it. The contract types it as `ExactFieldApi`. */
export type AnyFieldApi = FieldSnapshot<unknown, unknown> & Readonly<Record<string, unknown>>;

/** What a field object is built from, and the object itself. */
export interface FieldView {
  readonly snapshot: FieldSnapshot<unknown, unknown>;
  readonly api: AnyFieldApi;
}

// Handle members that are not commands: `peek` reads state, and validators go through `useValidator`.
const notCommands = new Set(["peek", "registerValidator"]);

const commandCache = new WeakMap<HandleLike, Readonly<Record<string, unknown>>>();
const viewSources = new WeakMap<HandleLike, Source<FieldView>>();
const refreshers = new WeakMap<object, () => void>();

/**
 * Gives the readers of a field a new field object, for state the adapter
 * keeps outside the store, such as the text typed in a number input.
 */
export const refreshField = (handle: object): void => refreshers.get(handle)?.();

/** Picks the field object from a view. */
export const pickApi = (view: FieldView): unknown => view.api;

/** The handle's commands, copied once. Core's commands are closures, so they need no binding. */
const commandsOf = (handle: HandleLike): Readonly<Record<string, unknown>> =>
  cached(commandCache, handle, () =>
    Object.fromEntries(Object.entries(handle).filter(([key, value]) => typeof value === "function" && !notCommands.has(key))),
  );

function makeView(handle: HandleLike, snapshot: FieldSnapshot<unknown, unknown>): FieldView {
  const api: AnyFieldApi = {
    ...snapshot,
    ...commandsOf(handle),
    handle,
    id: handle.id,
    path: handle.path,
    errorId: errorId(handle),
    ...piecesFor(handle),
    text: textOf(snapshot),
  };
  return { snapshot, api };
}

/**
 * The source of a field's view: its snapshot and the field object built
 * from it. The view keeps its identity until the snapshot changes or
 * `refreshField` runs, and the server and client views are one object while
 * they read the same.
 */
export const fieldViewSource = (handle: HandleLike): Source<FieldView> =>
  cached(viewSources, handle, () => {
    const field = fieldSource(handle);
    const listeners = new Set<() => void>();
    let stale = false;
    refreshers.set(handle, () => {
      stale = true;
      for (const listener of listeners) listener();
    });
    let current: FieldView | undefined;
    let initial: FieldView | undefined;
    return {
      subscribe(listener) {
        listeners.add(listener);
        const stop = field.subscribe(listener);
        return () => {
          listeners.delete(listener);
          stop();
        };
      },
      get() {
        const snapshot = field.get();
        if (stale || current?.snapshot !== snapshot) {
          // While nothing has changed since server rendering, the client view is
          // the server view, so a hydrated component doesn't render again.
          current = !stale && initial?.snapshot === snapshot ? initial : makeView(handle, snapshot);
          stale = false;
        }
        return current;
      },
      server() {
        const snapshot = field.server();
        if (initial?.snapshot !== snapshot) initial = current?.snapshot === snapshot ? current : makeView(handle, snapshot);
        return initial;
      },
    };
  });
