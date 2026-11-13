import type { Show } from "../errors.js";
import { problem } from "../problem.js";

declare const console: { warn(message: string): void };

// Development only. Every caller sits behind a NODE_ENV check, so a
// production bundle drops the calls and then this module.

// Both maps are keyed by the options object a store's core was made with,
// which names the store.
let warned: WeakSet<object> | undefined;
let prototypes: WeakMap<object, object> | undefined;

/** Warns once per store that it reads dirty state it doesn't track. */
export function warnUntracked(store: object): void {
  warned ??= new WeakSet();
  if (warned.has(store)) return;
  warned.add(store);
  console.warn(problem("dirty:untracked"));
}

/**
 * A copy of `snapshot`, from a store without dirty tracking, whose `dirty`
 * warns and then reads false. `dirty` is a getter on the copy's prototype, so
 * `Object.keys`, spread and `JSON.stringify` leave it out and a devtool that
 * copies the snapshot doesn't warn. The getter could be an own property, but
 * V8 then keeps every snapshot in its slow dictionary mode, which made reads
 * several times slower.
 */
export function watchDirty<S extends object>(snapshot: S, store: object): S {
  prototypes ??= new WeakMap();
  let prototype = prototypes.get(store);
  if (!prototype) {
    prototype = Object.defineProperty({}, "dirty", {
      get: () => {
        warnUntracked(store);
        return false;
      },
    });
    prototypes.set(store, prototype);
  }
  const copy: Record<string, unknown> = Object.create(prototype);
  for (const key in snapshot) if (key !== "dirty") copy[key] = Reflect.get(snapshot, key);
  // The copy has every member of `snapshot`, with `dirty` inherited.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return copy as S;
}

/** A `show` function whose argument's `dirty` warns, for a store without dirty tracking. */
export function watchShow(show: Exclude<Show, string>, store: object): Exclude<Show, string> {
  return (context) => show(watchDirty(context, store));
}
