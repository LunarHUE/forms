import { useEffect, useLayoutEffect, useReducer, useState } from "react";
import { type Hooks, optional, type UseSyncExternalStore } from "./compat.js";

// React's own hooks where it has them, and small fallbacks for React 16.8 and
// 17. Only the legacy entry imports this. Each choice is made once, here at
// load, so a component calls the same hooks on every render.

// The package has no node types, so this declares the one global the warning reads.
declare const process: { readonly env: { readonly NODE_ENV?: string } };

/** True when there is no DOM, as in server rendering. */
const onServer = typeof document === "undefined";

/**
 * The snapshot a component last committed and the function that read it.
 * The fallback keeps one per component and changes it only in effects.
 */
class Committed<S> {
  constructor(
    private value: S,
    private read: () => S,
  ) {}

  /** Records what the latest render read. */
  record(value: S, read: () => S): void {
    this.value = value;
    this.read = read;
  }

  /** True when the store holds a different snapshot from the recorded one, or reading it throws. */
  stale(): boolean {
    try {
      return !Object.is(this.value, this.read());
    } catch {
      return true;
    }
  }
}

const bump = (count: number): number => count + 1;

/**
 * The fallback on the client. It renders the current snapshot, then checks it
 * again in a layout effect, since a store write can land between render and
 * commit before the component subscribes. After that the subscription
 * re-renders it whenever the snapshot changes.
 */
function useStoreOnClient<S>(subscribe: (onChange: () => void) => () => void, getSnapshot: () => S): S {
  const value = getSnapshot();
  const [committed] = useState(() => new Committed(value, getSnapshot));
  const [, rerender] = useReducer(bump, 0);
  useLayoutEffect(() => {
    committed.record(value, getSnapshot);
    if (committed.stale()) rerender();
  }, [committed, value, getSnapshot]);
  useEffect(() => {
    const check = () => {
      if (committed.stale()) rerender();
    };
    // A write between the layout effect and this one has no listener yet.
    check();
    return subscribe(check);
  }, [committed, subscribe]);
  return value;
}

/**
 * The fallback on the server. It reads the server snapshot once and uses no
 * effects, since React before 18 warns about `useLayoutEffect` there.
 */
const useStoreOnServer: UseSyncExternalStore = (_subscribe, getSnapshot, getServerSnapshot) =>
  (getServerSnapshot ?? getSnapshot)();

const nativeId = optional("useId");

let lastId = 0;
const newId = (): string => `:f${(lastId += 1).toString(36)}:`;

/** The fallback id: a count, kept for the life of the component. Server and client counts differ. */
const useCountedId = (): string => useState(newId)[0];

let warned = false;

/** React's hooks where it has them, or fallbacks with the same contract on React 16.8 and 17. */
export const fallbacks: Hooks = {
  useSyncExternalStore: optional("useSyncExternalStore") ?? (onServer ? useStoreOnServer : useStoreOnClient),
  // The counted id doesn't match between server and client.
  useId: nativeId ?? useCountedId,
  /** On React 16.8 and 17 during server rendering, warns once in development that the id won't match the client's. */
  generatedIdUsed() {
    if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
      if (nativeId !== undefined || !onServer || warned) return;
      warned = true;
      console.warn(
        "@lunarhue/forms-react: a form was server rendered without an `id`. React before 18 has no `useId`, so the generated id can't match on the client. Pass `id` to `useForm`.",
      );
    }
  },
};
