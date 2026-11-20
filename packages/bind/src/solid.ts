import { bind, type BindOptions, type BindPlugin } from "@lunarhue/forms-core/plugins";
import { createEffect, createRoot, runWithOwner, untrack, type Accessor, type Setter } from "solid-js";

// The declarations bundle core's types, so a consumer's emitted declarations
// can name the type signal() returns only through this entry.
export type { BindPlugin };

/** What every `signal` call takes: `bind`'s `incoming` and `initial`. */
export type SolidOptions = Pick<BindOptions<unknown>, "incoming" | "initial">;

/**
 * Binds the form value to a Solid 2 signal, given as the getter and setter
 * `createSignal` returns. A form write sets the signal. A change to the
 * signal reaches the form when Solid runs its effects. The effect that
 * watches the signal lives in a root of its own, made when the form gets
 * its first listener and disposed when it loses its last.
 */
export function signal<T>(get: Accessor<T>, set: Setter<T>, options?: SolidOptions): BindPlugin<T> {
  return bind<T>({
    ...options,
    get: () => untrack(get),
    // Form writes can come from inside a component or a computation, where
    // Solid throws on a signal write.
    set: (value) => runWithOwner(null, () => set(() => value)),
    // Detached from whatever owner the form gets its first listener under,
    // so only `dispose` ends the effect.
    subscribe: (listener) =>
      runWithOwner(null, () =>
        createRoot((dispose) => {
          // A form write comes back here too, after Solid flushes. `bind`
          // finds the form already holds that value and writes nothing.
          createEffect(get, () => listener());
          return dispose;
        }),
      ),
  });
}
