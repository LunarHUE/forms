import { describe, expect, it, type Mock, vi } from "vitest";
import { createFormsCore } from "../forms-core.js";
import type { WriteRecord } from "../plugin.js";
import { definePlugin } from "../plugins.js";
import { type BindOptions, bind } from "./bind.js";
import type { Resolve } from "./rebase.js";

/** A store the app owns, with a spy on what the binding sets. */
interface Outside<T> {
  state: T;
  readonly listeners: Set<() => void>;
  readonly sets: Mock<(value: T, records: readonly WriteRecord[]) => void>;
  change(next: T): void;
  readonly options: BindOptions<T>;
}

function outside<T>(state: T, merge?: (state: T, value: T) => T): Outside<T> {
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const sets = vi.fn<(value: T, records: readonly WriteRecord[]) => void>();
  const box: Outside<T> = {
    state,
    listeners,
    sets,
    change(next) {
      box.state = next;
      notify();
    },
    options: {
      get: () => box.state,
      set: (value, records) => {
        sets(value, records);
        box.state = merge ? merge(box.state, value) : value;
        notify();
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => void listeners.delete(listener);
      },
    },
  };
  return box;
}

interface Profile {
  name: string;
  email: string;
  tags: string[];
}

const defaults: Profile = { name: "form", email: "form@x", tags: [] };
const profile = createFormsCore().define({ defaultValues: defaults });

/** A store bound to `box` and listened to, as a mounted form is. */
function bound(box: Outside<Profile>, options: Partial<BindOptions<Profile>> = {}) {
  const store = profile.createStore(undefined, { plugins: [bind({ ...box.options, ...options })] });
  const stop = store.subscribeForm(() => {});
  return { store, stop };
}

const causes = (records: readonly WriteRecord[]) => records.map((record) => [record.type, record.cause]);

describe("bind", () => {
  it("starts with the outside value as value and baseline", () => {
    const box = outside<Profile>({ name: "Ada", email: "ada@x", tags: ["a"] });
    const seen: WriteRecord[] = [];
    const spy = definePlugin({ name: "spy", setup: () => ({ onWrite: (records) => void seen.push(...records) }) });
    const store = profile.createStore(undefined, { plugins: [bind(box.options), spy] });
    expect(store.root.peek().value).toEqual({ name: "Ada", email: "ada@x", tags: ["a"] });
    expect(seen).toEqual([]);
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(store.changes()).toEqual([]);
    expect(box.sets).not.toHaveBeenCalled();
    // Making the store listens to nothing outside.
    expect(box.listeners.size).toBe(0);
  });

  it("sets the outside value once per batch, without a timer", () => {
    const box = outside<Profile>({ ...defaults });
    const { store } = bound(box);
    store.root.at("name").setValue("Ada");
    expect(box.sets).toHaveBeenCalledTimes(1);
    expect(box.sets.mock.calls[0]?.[0]).toEqual({ ...defaults, name: "Ada" });
    expect(causes(box.sets.mock.calls[0]?.[1] ?? [])).toEqual([["value", "user"]]);
    store.batch(() => {
      store.root.at("name").setValue("B");
      store.root.at("email").setValue("b@x");
    });
    expect(box.sets).toHaveBeenCalledTimes(2);
    expect(box.sets.mock.calls[1]?.[1]).toHaveLength(2);
    expect(box.state).toEqual({ name: "B", email: "b@x", tags: [] });
  });

  it("skips writes that change no value", () => {
    const box = outside<Profile>({ ...defaults });
    const { store } = bound(box);
    store.root.at("name").setTouched(true);
    expect(box.sets).not.toHaveBeenCalled();
  });

  it("writes outside changes into the form and doesn't send them back", () => {
    const box = outside<Profile>({ ...defaults });
    const seen: WriteRecord[] = [];
    const spy = definePlugin({ name: "spy", setup: () => ({ onWrite: (records) => void seen.push(...records) }) });
    const store = profile.createStore(undefined, { plugins: [bind(box.options), spy] });
    store.subscribeForm(() => {});
    seen.length = 0;
    box.change({ ...defaults, name: "outside" });
    expect(store.root.peek().value).toEqual({ ...defaults, name: "outside" });
    expect(box.sets).not.toHaveBeenCalled();
    expect(seen.map((record) => record.cause)).toEqual([{ plugin: "bind" }]);
    expect(store.getSnapshot(["name"]).edited).toBe(false);
  });

  it("skips an outside notice whose value is the one it last saw", () => {
    const box = outside<Profile>({ ...defaults });
    const { store } = bound(box);
    const before = store.root.peek().value;
    box.change(box.state);
    expect(store.root.peek().value).toBe(before);
  });

  it("ignores the outside store's notice while it sets, as a merging store sends", () => {
    // The outside store merges what it is given into a new object, as zustand does.
    type Extended = Profile & { extra?: number };
    const box = outside<Extended>({ ...defaults, extra: 1 }, (state, value) => ({ ...state, ...value }));
    const store = createFormsCore()
      .define<Extended>({ defaultValues: defaults })
      .createStore(undefined, { plugins: [bind(box.options)] });
    store.subscribeForm(() => {});
    const writes = vi.fn<() => void>();
    store.subscribe(["name"], writes);
    store.root.at("name").setValue("Ada");
    expect(box.state).toEqual({ ...defaults, name: "Ada", extra: 1 });
    expect(box.sets).toHaveBeenCalledTimes(1);
    expect(writes).toHaveBeenCalledTimes(1);
  });

  it("sends array commands with their records", () => {
    const box = outside<Profile>({ ...defaults, tags: ["a", "b"] });
    const { store } = bound(box);
    const tags = store.root.at("tags");
    tags.push("c");
    expect(box.state.tags).toEqual(["a", "b", "c"]);
    tags.insert(0, "z");
    expect(box.state.tags).toEqual(["z", "a", "b", "c"]);
    tags.remove(1);
    expect(box.state.tags).toEqual(["z", "b", "c"]);
    tags.move(0, 2);
    expect(box.state.tags).toEqual(["b", "c", "z"]);
    expect(box.sets.mock.calls.map(([, records]) => records.map((record) => record.type))).toEqual([
      ["insert"],
      ["insert"],
      ["remove"],
      ["move"],
    ]);
  });

  it("sends the value a reset goes back to", () => {
    const box = outside<Profile>({ ...defaults, name: "start" });
    const { store } = bound(box);
    store.root.at("name").setValue("edited");
    store.reset();
    expect(box.state.name).toBe("start");
    expect(box.sets.mock.calls[1]?.[1]?.every((record) => record.cause === "reset")).toBe(true);
  });

  it("listens only while the form store has listeners, and catches up when it starts", () => {
    const box = outside<Profile>({ ...defaults });
    const store = profile.createStore(undefined, { plugins: [bind(box.options)] });
    box.change({ ...defaults, name: "early" });
    expect(store.root.peek().value.name).toBe("form");
    const first = store.subscribe(["name"], () => {});
    const second = store.subscribeForm(() => {});
    expect(store.root.peek().value.name).toBe("early");
    expect(box.listeners.size).toBe(1);
    first();
    expect(box.listeners.size).toBe(1);
    second();
    expect(box.listeners.size).toBe(0);
    box.change({ ...defaults, name: "late" });
    expect(store.root.peek().value.name).toBe("early");
  });

  describe("incoming", () => {
    it('"replace" writes over the form and keeps the baseline', () => {
      const box = outside<Profile>({ ...defaults });
      const { store } = bound(box);
      store.root.at("email").setValue("mine@x");
      box.change({ ...defaults, name: "outside" });
      expect(store.root.peek().value).toEqual({ ...defaults, name: "outside" });
      expect(store.changes().map((change) => change.path)).toEqual([["name"]]);
    });

    it('"rebase" moves the baseline and keeps what the user edited', () => {
      const box = outside<Profile>({ ...defaults });
      const { store } = bound(box, { incoming: "rebase" });
      store.root.at("name").setValue("mine");
      // The edit went out, so the outside store changes from there.
      box.change({ ...box.state, name: "server", email: "server@x" });
      expect(store.root.peek().value).toEqual({ name: "mine", email: "server@x", tags: [] });
      expect(store.changes()).toEqual([{ path: ["name"], baseline: "server", value: "mine" }]);
      // The kept leaf goes out with the next form write.
      store.root.at("tags").push("t");
      expect(box.state).toEqual({ name: "mine", email: "server@x", tags: ["t"] });
    });

    it("takes a function that picks per leaf", () => {
      const box = outside<Profile>({ ...defaults });
      const resolve = vi.fn<Resolve>(() => "keep");
      const { store } = bound(box, { incoming: resolve });
      box.change({ ...defaults, name: "server" });
      expect(resolve).toHaveBeenCalledTimes(1);
      expect(store.root.peek().value).toEqual(defaults);
      expect(store.changes()).toEqual([{ path: ["name"], baseline: "server", value: "form" }]);
    });
  });

  it('with initial "form", keeps the defaults and sends them out when listening starts', () => {
    const box = outside<Profile>({ name: "outside", email: "", tags: [] });
    const store = profile.createStore(undefined, { plugins: [bind({ ...box.options, initial: "form" })] });
    expect(store.root.peek().value).toEqual(defaults);
    expect(box.sets).not.toHaveBeenCalled();
    const stop = store.subscribeForm(() => {});
    expect(box.sets).toHaveBeenCalledWith(defaults, []);
    expect(box.state).toEqual(defaults);
    stop();
    // Listening again catches up with the outside store instead.
    box.change({ ...defaults, name: "later" });
    store.subscribeForm(() => {});
    expect(store.root.peek().value.name).toBe("later");
    expect(box.sets).toHaveBeenCalledTimes(1);
  });

  it("keeps two forms of one definition bound to two stores apart", () => {
    const one = outside<Profile>({ ...defaults, name: "one" });
    const two = outside<Profile>({ ...defaults, name: "two" });
    const a = bound(one).store;
    const b = bound(two).store;
    a.root.at("email").setValue("a@x");
    two.change({ ...two.state, name: "two!" });
    expect(one.state).toEqual({ ...defaults, name: "one", email: "a@x" });
    expect(two.state.email).toBe("form@x");
    expect(a.root.peek().value.name).toBe("one");
    expect(b.root.peek().value).toEqual({ ...defaults, name: "two!" });
  });

  it("throws when a form has two bindings", () => {
    const box = outside<Profile>({ ...defaults });
    const twice = createFormsCore().define({ defaultValues: defaults, plugins: [bind(box.options)] });
    expect(() => twice.createStore(undefined, { plugins: [bind(box.options)] })).toThrow('Two plugins are named "bind".');
  });

  it('starts the server snapshot at the outside value with initial "outside", and at the defaults with "form"', () => {
    const box = outside<Profile>({ ...defaults, name: "outside" });
    const store = profile.createStore(undefined, { plugins: [bind(box.options)] });
    expect(store.getServerSnapshot(["name"]).value).toBe("outside");
    expect(store.getSnapshot(["name"]).value).toBe("outside");
    const kept = profile.createStore(undefined, { plugins: [bind({ ...box.options, initial: "form" })] });
    expect(kept.getServerSnapshot(["name"]).value).toBe("form");
  });
});
