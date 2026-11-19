/**
 * The forms on the page, for the devtools. Framework-free: demos register
 * themselves from whatever framework renders them, and the dock reads the
 * list. One module instance per page, shared by every island that imports it.
 */

export interface FormEntry {
  /** Unique on the page. A demo uses its own id, so two demos can share a form name. */
  readonly id: string;
  /** The form's name, shown in the outline tag and the dock. */
  readonly name: string;
  /** The outlined element around the form. */
  readonly element: Element | null;
}

export interface RegistryState {
  /** Registered forms, in registration order. */
  readonly forms: readonly FormEntry[];
  /** Id of the selected form, or null. */
  readonly selected: string | null;
}

type Listener = (state: RegistryState) => void;

export interface Registry {
  /** Add a form, or replace the entry with the same id (keeping its place and selection). */
  register(entry: FormEntry): void;
  /** Remove a form. Clears the selection if it was selected. */
  unregister(id: string): void;
  /** Select a form by id, or clear the selection with null. Unknown ids are ignored. */
  select(id: string | null): void;
  /** The selected form, or undefined. */
  selected(): FormEntry | undefined;
  list(): readonly FormEntry[];
  /** The current state. The same object until something changes. */
  getState(): RegistryState;
  /** Call `listener` after every change. Returns the unsubscribe function. */
  subscribe(listener: Listener): () => void;
}

export function createRegistry(): Registry {
  let state: RegistryState = { forms: [], selected: null };
  const listeners = new Set<Listener>();

  const set = (next: RegistryState) => {
    state = next;
    for (const listener of listeners) listener(state);
  };

  return {
    register(entry) {
      const index = state.forms.findIndex((form) => form.id === entry.id);
      const forms = index === -1 ? [...state.forms, entry] : state.forms.with(index, entry);
      set({ ...state, forms });
    },
    unregister(id) {
      if (!state.forms.some((form) => form.id === id)) return;
      set({
        forms: state.forms.filter((form) => form.id !== id),
        selected: state.selected === id ? null : state.selected,
      });
    },
    select(id) {
      if (id === state.selected) return;
      if (id !== null && !state.forms.some((form) => form.id === id)) return;
      set({ ...state, selected: id });
    },
    selected: () => state.forms.find((form) => form.id === state.selected),
    list: () => state.forms,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The page's registry. */
export const registry = createRegistry();
