import type { FormEntry, Hook } from "../hook.js";

/** A registered form as the panel lists it. */
export interface Listed {
  /** The hook's id for the entry. */
  readonly id: number;
  readonly entry: FormEntry;
  /**
   * The store's `id`, or `form 2` for the second form when the id is one an
   * adapter made up. An ordinal follows when two forms on the page share one.
   */
  readonly label: string;
}

/**
 * Whether `id` looks like one an adapter made up: React's `useId` (`:r0:`,
 * `«r0»`, `_R_2_`), the adapter's own counter on React 16 and 17 (`:f1:`),
 * and Solid's `createUniqueId` (`cl-3`, `0-0`, `00`).
 */
export const generatedId = (id: string): boolean => /^(:\w+:|«\w+»|_\w_\w+_|cl-\d+|[\d-]+)$/.test(id);

/** The hook's forms in the order they registered. */
export function listForms(hook: Hook): Listed[] {
  const names = [...hook.forms.values()].map((entry, index) => (generatedId(entry.store.id) ? `form ${index + 1}` : entry.store.id));
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  const seen = new Map<string, number>();
  return [...hook.forms].map(([id, entry], index) => {
    const name = names[index] ?? entry.store.id;
    if ((counts.get(name) ?? 0) < 2) return { id, entry, label: name };
    const ordinal = (seen.get(name) ?? 0) + 1;
    seen.set(name, ordinal);
    return { id, entry, label: `${name} #${ordinal}` };
  });
}

/** True when the form has `dirty()`, so its snapshots have `dirty`. */
export const hasPlugin = (entry: FormEntry, name: string): boolean => entry.ctx.installed.some((plugin) => plugin.name === name);
