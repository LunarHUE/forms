import type { FieldSnapshot } from "@lunarhue/forms-core";
import type { HandleLike } from "./field.js";
import { type AnyInputOptions, inputPropsFor } from "./input-props.js";
import { errorId } from "./input.js";
import { type NumberText, numberTextSource } from "./number-text.js";
import { cached, type Source } from "./select.js";
import { fieldSource } from "./sources.js";

/** A field object as the runtime builds it. The contract types it as `ExactFieldApi`. */
export type AnyFieldApi = FieldSnapshot<unknown, unknown> & Readonly<Record<string, unknown>>;

/** What a field object is built from, and the object itself. */
export interface FieldView {
  readonly snapshot: FieldSnapshot<unknown, unknown>;
  readonly text: NumberText | undefined;
  readonly api: AnyFieldApi;
}

// Handle members that are not commands: `peek` reads state, and validators go through `useValidator`.
const notCommands = new Set(["peek", "registerValidator"]);

const commandCache = new WeakMap<HandleLike, Readonly<Record<string, unknown>>>();
const viewSources = new WeakMap<HandleLike, Source<FieldView>>();

/** The handle's commands, copied once. Core's commands are closures, so they need no binding. */
const commandsOf = (handle: HandleLike): Readonly<Record<string, unknown>> =>
  cached(commandCache, handle, () =>
    Object.fromEntries(Object.entries(handle).filter(([key, value]) => typeof value === "function" && !notCommands.has(key))),
  );

function makeView(handle: HandleLike, snapshot: FieldSnapshot<unknown, unknown>, text: NumberText | undefined): FieldView {
  const api: AnyFieldApi = {
    ...snapshot,
    ...commandsOf(handle),
    handle,
    id: handle.id,
    path: handle.path,
    errorId: errorId(handle),
    inputProps: (options?: AnyInputOptions) => inputPropsFor(handle, snapshot, text, options),
  };
  return { snapshot, text, api };
}

/**
 * The source of a field's view: its snapshot, its number text and the field
 * object built from both. The view keeps its identity until either changes,
 * and the server and client views are one object while they read the same.
 */
export const fieldViewSource = (handle: HandleLike): Source<FieldView> =>
  cached(viewSources, handle, () => {
    const field = fieldSource(handle);
    const texts = numberTextSource(handle);
    let current: FieldView | undefined;
    let initial: FieldView | undefined;
    return {
      subscribe(listener) {
        const stopField = field.subscribe(listener);
        const stopText = texts.subscribe(listener);
        return () => {
          stopField();
          stopText();
        };
      },
      get() {
        const snapshot = field.get();
        const text = texts.get();
        if (current?.snapshot !== snapshot || current.text !== text) {
          // While nothing has changed since server rendering, the client view is
          // the server view, so a hydrated component doesn't render again.
          current = initial?.snapshot === snapshot && text === undefined ? initial : makeView(handle, snapshot, text);
        }
        return current;
      },
      server() {
        const snapshot = field.server();
        if (initial?.snapshot !== snapshot) {
          initial = current?.snapshot === snapshot && current.text === undefined ? current : makeView(handle, snapshot, undefined);
        }
        return initial;
      },
    };
  });
