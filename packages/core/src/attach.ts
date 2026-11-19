import type { Path } from "./path.js";
import type { Part } from "./plugin.js";
import { problem } from "./problem.js";
import { hosts } from "./store/hosts.js";

const attachedTo = new WeakMap<object, Set<readonly Part[]>>();

/**
 * Attaches `parts` at the field of `handle`, as a framework adapter does
 * when a field type or fieldset that carries them renders. It does the work
 * once per handle and list, so it can be called on every render. A part
 * whose path is set attaches at that dotted name below the field.
 *
 * Before the store has listeners the parts attach now, and what they write
 * becomes the starting state, which the server snapshot shows. After that
 * they attach on a microtask, so a write doesn't land while a framework is
 * rendering. Pass `now` from a framework whose listeners take writes while
 * it renders, as Solid's do, to attach now every time. What the parts write
 * makes no write records. A part whose plugin the store doesn't have throws
 * `plugins:missing`.
 */
export function attach(handle: { readonly store: object; readonly path: Path }, parts: readonly Part[], now?: boolean): void {
  let seen = attachedTo.get(handle);
  if (!seen) attachedTo.set(handle, (seen = new Set()));
  if (seen.has(parts)) return;
  seen.add(parts);
  const host = hosts.get(handle.store);
  if (host) host.attach(handle.path, parts, now);
  else if (parts[0]) throw new Error(problem("plugins:missing", parts[0].plugin));
}
