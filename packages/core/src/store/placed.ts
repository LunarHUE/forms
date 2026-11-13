import type { Path } from "../path.js";

/** A map key for a stable path. Numbers and their strings give the same key. */
export const keyOf = (path: Path): string => JSON.stringify(path.map(String));

/** Errors to put on each field, by path key. */
export type Placed<E> = Map<string, { readonly path: Path; readonly errors: E[] }>;

/** Adds `errors` to the field at `path`, after the ones it already has. */
export const addErrors = <E>(placed: Placed<E>, path: Path, errors: readonly E[]) => {
  if (errors.length === 0) return;
  const key = keyOf(path);
  const entry = placed.get(key);
  if (entry) entry.errors.push(...errors);
  else placed.set(key, { path, errors: [...errors] });
};
