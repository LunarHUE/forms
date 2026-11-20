import type { AnyFormStore, InvalidField } from "./store.js";
import { coreOf } from "./store/cores.js";
import { reach } from "./store/handles.js";

/**
 * Returns every field of `store` with an error, in value order: validation
 * errors and those `setErrors` set, on enabled and disabled fields alike,
 * with the root first. For an error summary above the form. Returns an empty
 * list when there is none. A read for event handlers and effects. To render
 * the list, follow it with `subscribeInvalid`, or use the adapter's hook.
 */
export const invalidFields = <E>(store: AnyFormStore<E>): readonly InvalidField<E>[] => {
  const core = coreOf(store);
  return core.invalid().map((path) => {
    const { name, errors } = core.getSnapshot(path);
    // `reach` makes the handle even for a key the value lacks, where
    // `handle.setErrors` can put errors. Its errors are this store's `E`.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const field = reach(store as AnyFormStore<unknown>, path) as InvalidField<E>["field"];
    return { field, name, errors };
  });
};

/**
 * Calls `listener` after any write to `store` that changes what
 * `invalidFields` returns: a field gains or loses its errors, an error list
 * changes, or a field with errors moves. Returns the function that
 * unsubscribes.
 */
export const subscribeInvalid = (store: AnyFormStore<unknown>, listener: () => void): (() => void) => coreOf(store).subscribeInvalid(listener);
