import type { FormEntry, Hook } from "../hook.js";

/** A registered form as the panel lists it. */
export interface Listed {
  /** The hook's id for the entry. */
  readonly id: number;
  readonly entry: FormEntry;
  /** The store's `id`, with an ordinal when two forms on the page share one. */
  readonly label: string;
}

/** The hook's forms in the order they registered. */
export function listForms(hook: Hook): Listed[] {
  const counts = new Map<string, number>();
  for (const entry of hook.forms.values()) counts.set(entry.store.id, (counts.get(entry.store.id) ?? 0) + 1);
  const seen = new Map<string, number>();
  return [...hook.forms].map(([id, entry]) => {
    const name = entry.store.id;
    if ((counts.get(name) ?? 0) < 2) return { id, entry, label: name };
    const ordinal = (seen.get(name) ?? 0) + 1;
    seen.set(name, ordinal);
    return { id, entry, label: `${name} #${ordinal}` };
  });
}

/** True when the form has `dirty()`, so its snapshots have `dirty`. */
export const hasPlugin = (entry: FormEntry, name: string): boolean => entry.ctx.installed.some((plugin) => plugin.name === name);
