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

  it("hands update the state before the write, for one key of a map", () => {
    interface Reviews {
      summaries: Record<string, Profile>;
    }
    const store = createStore<Reviews>()(() => ({
      summaries: { a: { name: "Ada", email: "ada@x" }, b: { name: "Grace", email: "grace@x" } },
    }));
    const update = vi.fn<(value: Profile, state: Reviews) => Partial<Reviews>>((value, state) => ({ summaries: { ...state.summaries, a: value } }));
    const form = profile.createStore(undefined, {
      plugins: [zustand(store, { select: (state) => state.summaries.a!, update })],
    });
    form.subscribeForm(() => {});

    const before = store.getState();
    form.root.at("name").setValue("Lin");
    expect(update).toHaveBeenCalledWith({ name: "Lin", email: "ada@x" }, before);
    expect(store.getState().summaries).toEqual({
      a: { name: "Lin", email: "ada@x" },
      b: { name: "Grace", email: "grace@x" },
    });
  });

  it("compares a slice that select builds with isEqual", () => {
    interface Review {
      verdict: string;
      body: string;
      count: number;
    }
    const review = createFormsCore().define({ defaultValues: { verdict: "", body: "" } });
    const store = createStore<Review>()(() => ({ verdict: "ok", body: "fine", count: 0 }));
    const form = review.createStore(undefined, {
      plugins: [
        zustand(store, {
          select: ({ verdict, body }) => ({ verdict, body }),
          update: (value) => value,
          isEqual: (previous, next) => previous.verdict === next.verdict && previous.body === next.body,
        }),
      ],
    });
    const before = form.root.peek().value;
    const stop = form.subscribeForm(() => {});
    expect(form.root.peek().value).toBe(before);

    store.setState({ count: 1 });
    expect(form.root.peek().value).toBe(before);

    // Listening again catches up with the store, which hasn't changed.
    stop();
    form.subscribeForm(() => {});
    expect(form.root.peek().value).toBe(before);

    store.setState({ verdict: "no" });
    expect(form.root.peek().value).toEqual({ verdict: "no", body: "fine" });

    form.root.at("body").setValue("broken");
    expect(store.getState()).toEqual({ verdict: "no", body: "broken", count: 1 });
    const written = form.root.peek().value;
    store.setState({ count: 2 });
    expect(form.root.peek().value).toBe(written);
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
