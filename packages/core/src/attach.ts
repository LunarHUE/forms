import type { Path } from "./path.js";
import type { Part } from "./plugin.js";
import { problem } from "./problem.js";
import { hosts } from "./store/hosts.js";

// Core has no node types, so this declares the global the development check reads.
declare const process: { readonly env: { readonly NODE_ENV?: string } };

/**
 * Attaches `parts` at the field of `handle`, as a framework adapter does
 * when a field type or fieldset that carries them renders. Each part
 * attaches once per path, so it can be called on every render. A part
 * whose path is set attaches at that dotted name below the field.
 *
 * Before the store has listeners the parts attach now, and what they write
 * becomes the starting state, which the server snapshot shows. After that
 * they attach on a microtask, so a write doesn't land while a framework is
 * rendering. Pass `now` from a framework whose listeners take writes while
 * it renders, as Solid's do, to attach now every time. What the parts write
 * makes no write records. In development, a part whose plugin the store
 * doesn't have throws `plugins:missing`.
 */
export function attach(handle: { readonly store: object; readonly path: Path }, parts: readonly Part[], now?: boolean): void {
  const host = hosts.get(handle.store);
  if (host) host.attach(handle.path, parts, now);
  else if (typeof process !== "undefined" && process.env.NODE_ENV !== "production" && parts[0]) {
    throw new Error(problem("plugins:missing", parts[0].plugin));
  }
}
