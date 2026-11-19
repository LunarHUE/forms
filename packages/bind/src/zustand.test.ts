import { createFormsCore } from "@lunarhue/forms-core";
import { dirty } from "@lunarhue/forms-core/plugins";
import { describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import { zustand } from "./zustand.js";

interface Profile {
  name: string;
  email: string;
}

const defaults: Profile = { name: "", email: "" };
const profile = createFormsCore({ plugins: [dirty()] }).define({ defaultValues: defaults });

describe("zustand", () => {
  it("binds the whole state", () => {
    const store = createStore<Profile>()(() => ({ name: "Ada", email: "ada@x" }));
    const form = profile.createStore(undefined, { plugins: [zustand(store)] });
    form.subscribeForm(() => {});
    expect(form.root.peek().value).toEqual({ name: "Ada", email: "ada@x" });

    form.root.at("name").setValue("Grace");
    expect(store.getState()).toEqual({ name: "Grace", email: "ada@x" });

    store.setState({ email: "grace@x" });
    expect(form.root.peek().value).toEqual({ name: "Grace", email: "grace@x" });
  });

  it("binds a slice and skips changes that leave it alone", () => {
    interface App {
      profile: Profile;
      count: number;
    }
    const store = createStore<App>()(() => ({ profile: { name: "Ada", email: "ada@x" }, count: 0 }));
    const select = vi.fn<(state: App) => Profile>((state) => state.profile);
    const form = profile.createStore(undefined, {
      plugins: [zustand(store, { select, update: (value) => ({ profile: value }) })],
    });
    form.subscribeForm(() => {});
    expect(form.root.peek().value).toEqual({ name: "Ada", email: "ada@x" });

    form.root.at("email").setValue("new@x");
    expect(store.getState()).toEqual({ profile: { name: "Ada", email: "new@x" }, count: 0 });

    const before = form.root.peek().value;
    store.setState({ count: 1 });
    expect(form.root.peek().value).toBe(before);

    store.setState({ profile: { name: "Outside", email: "o@x" } });
    expect(form.root.peek().value).toEqual({ name: "Outside", email: "o@x" });
    expect(store.getState().count).toBe(1);
  });

  it("passes incoming and initial through", () => {
    const store = createStore<Profile>()(() => ({ name: "Ada", email: "ada@x" }));
    const form = profile.createStore(undefined, { plugins: [zustand(store, { initial: "form", incoming: "rebase" })] });
    expect(form.root.peek().value).toEqual(defaults);
    form.subscribeForm(() => {});
    expect(store.getState()).toEqual(defaults);

    form.root.at("name").setValue("mine");
    store.setState({ name: "server", email: "server@x" });
    expect(form.root.peek().value).toEqual({ name: "mine", email: "server@x" });
    expect(form.changes()).toEqual([{ path: ["name"], baseline: "server", value: "mine" }]);
  });
});
