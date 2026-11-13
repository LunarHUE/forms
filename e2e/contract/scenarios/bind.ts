import { zustand } from "@lunarhue/forms-bind/zustand";
import type { HandleBase } from "@lunarhue/forms-core";
import { type Rebase, rebase } from "@lunarhue/forms-core/plugins/rebase";
import { createStore } from "zustand/vanilla";
import { fakeServer } from "../fake-server.js";
import type { ProbeSource } from "../probe.js";
import { scenario } from "../scenario.js";

export interface Profile {
  name: string;
  email: string;
  city: string;
}

/** The app's own state, with more in it than the form edits. */
interface AppState {
  profile: Profile;
  theme: "light" | "dark";
}

/**
 * Makes the outside store a page binds its form to: a vanilla zustand store,
 * which no framework owns. A page makes its own, so every server render and
 * every page load starts from these values.
 */
function createAppStore() {
  return createStore<AppState>()(() => ({
    profile: { name: "Ada Lovelace", email: "ada@example.com", city: "London" },
    theme: "light",
  }));
}

type AppStore = ReturnType<typeof createAppStore>;

/** What the server sends when the page asks for a fresh copy. */
const freshProfile: Profile = { name: "Augusta Ada King", email: "ada.king@example.com", city: "East Horsley" };

/** What `refresh` needs of the form's store. */
interface RebaseTarget {
  readonly root: HandleBase<Profile>;
  readonly plugins: { readonly rebase: Rebase };
}

const labels = { name: "Name", email: "Email", city: "City", change: "Change the store", refresh: "Refresh" };

/**
 * A form bound both ways to an outside store, starting from it on the server,
 * and a rebase that keeps what the user edited.
 */
export const bindScenario = {
  ...scenario("bind", "Bind and rebase", {
    values: { [labels.name]: "Ada Lovelace", [labels.email]: "ada@example.com", [labels.city]: "London" },
  }),
  labels,
  freshProfile,
  submit: { idle: "Save", busy: "Saving..." },
  createAppStore,
  /** The binding to the store's `profile` slice. */
  bindTo: (store: AppStore) =>
    zustand(store, { select: (state) => state.profile, update: (profile: Profile) => ({ profile }) }),
  /** The probe's sources: the fake server and the outside store's whole state. */
  sources: (store: AppStore): Readonly<Record<string, ProbeSource>> => ({
    server: fakeServer,
    outside: { get: () => store.getState(), subscribe: (listener) => store.subscribe(() => listener()) },
  }),
  /** A change made to the store by something other than the form. */
  changeOutside: (store: AppStore): void => {
    store.setState({ profile: { ...store.getState().profile, name: "Grace Hopper", email: "grace@example.com" } });
  },
  /** Loads a fresh copy and rebases onto it, keeping every field the user edited. */
  refresh: async (form: RebaseTarget): Promise<void> => {
    const fresh = await fakeServer.load(freshProfile);
    form.plugins.rebase(form.root, fresh, (leaf) => (leaf.edited ? "keep" : "take"));
  },
  definition: {
    // Never shown: the binding starts the form from the store.
    defaultValues: { name: "", email: "", city: "" },
    plugins: [rebase()] as const,
    onSubmit: async (value: Profile) => {
      const count = await fakeServer.save(value);
      return `Saved ${value.name} (save ${count}).`;
    },
  },
};
