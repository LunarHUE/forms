import type { HandleLike } from "./field.js";
import { errorIdOf } from "./input-props.js";
import { addPieces, type PiecesHandle } from "./pieces.js";
import { defineGetters, fieldReader } from "./reader.js";

/**
 * Builds the field object for a handle: snapshot getters over one signal,
 * the handle's commands, `id` and `path`, `handle`, `errorId`, and the
 * pieces (`text`, `setText`, `setNumberText`, `ref`, and a `handleBlur` that
 * also drops typed number text).
 */
export function createFieldApi(handle: HandleLike): object {
  const read = fieldReader(handle);
  const field: Record<string, unknown> = {};
  // Array snapshots have `keys` on top of the members every snapshot has.
  defineGetters(field, Object.keys(handle.store.getSnapshot(handle.path)), read);
  // Core's handle commands read no `this`, so they are copied as they are. The
  // field reads state through its getters and validators through `createValidator`.
  // The plain members `id`, `path` and an item's `key` never change for a
  // handle, so they are copied too. `store` stays on `handle`.
  for (const [name, member] of Object.entries(handle)) {
    if (name !== "peek" && name !== "registerValidator" && name !== "store") field[name] = member;
  }
  field.handle = handle;
  field.errorId = errorIdOf(handle);
  // Every core handle has `setValue` and `handleBlur`. `HandleLike` only names what reading needs.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  addPieces(field, handle as unknown as PiecesHandle, read);
  return field;
}
