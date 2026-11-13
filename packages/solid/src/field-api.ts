import { getOwner, runWithOwner } from "solid-js";
import type { HandleLike } from "./field.js";
import { buildInputProps, errorIdOf, optionsKey, type AnyInputOptions, type InputHandle, type InputSource } from "./input-props.js";
import { defineGetters, fieldReader } from "./reader.js";
import { elementRegistrar } from "./refs.js";

/** The input source for a handle, reading through `read`. Its registrar belongs to the current owner. */
export function inputSourceFor(handle: HandleLike, read: InputSource["read"]): InputSource {
  return {
    // Every core handle has `setValue` and `handleBlur`. `HandleLike` only names what reading needs.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    handle: handle as unknown as InputHandle,
    read,
    register: elementRegistrar(handle),
  };
}

/**
 * Builds the field object for a handle: snapshot getters over one signal,
 * the handle's commands, `handle`, `errorId`, and `inputProps`,
 * which returns the same props object for the same options.
 */
export function createFieldApi(handle: HandleLike): object {
  const owner = getOwner();
  const read = fieldReader(handle);
  const field: Record<string, unknown> = {};
  // Array snapshots have `keys` on top of the members every snapshot has.
  defineGetters(field, Object.keys(handle.store.getSnapshot(handle.path)), read);
  // Core's handle commands read no `this`, so they are copied as they are. The
  // field reads state through its getters and validators through `createValidator`.
  for (const [name, member] of Object.entries(handle)) {
    if (typeof member === "function" && name !== "peek" && name !== "registerValidator") field[name] = member;
  }
  field.handle = handle;
  field.errorId = errorIdOf(handle);

  let source: InputSource | undefined;
  const cache = new Map<string, unknown>();
  field.inputProps = (options?: AnyInputOptions) => {
    const key = optionsKey(options);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    // The props may first be asked for inside a spread's computation. They belong to the field's owner instead.
    const props = runWithOwner(owner, () => {
      source ??= inputSourceFor(handle, read);
      return buildInputProps(source, options);
    });
    cache.set(key, props);
    return props;
  };
  return field;
}
