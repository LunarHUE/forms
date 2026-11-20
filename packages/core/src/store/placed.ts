import type { Path } from "../path.js";
import { problem } from "../problem.js";
import type { StoreCore } from "./core.js";

// Core has no node types, so this declares the globals the development warning uses.
declare const process: { readonly env: { readonly NODE_ENV?: string } };
declare const console: { warn(message: string): void };

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

// The unknown names each store has warned about, so a form validator that runs on every change warns once.
const warned = /* @__PURE__ */ new WeakMap<object, Set<string>>();

/**
 * Adds `errors` to the field with dotted name `name`. When no field has that
 * name they go to the root, after the ones it already has, and development
 * warns once per name.
 */
export const addNamed = <E>(placed: Placed<E>, core: Pick<StoreCore<E>, "pathOf">, name: string, errors: readonly E[]) => {
  const path = core.pathOf(name, true);
  if (!path && errors.length > 0 && typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
    let names = warned.get(core);
    if (!names) warned.set(core, (names = new Set()));
    if (!names.has(name)) {
      names.add(name);
      console.warn(problem("field:unknown", name));
    }
  }
  addErrors(placed, path ?? [], errors);
};
