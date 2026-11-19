import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type Part,
  type Plugins,
  createFormsCore,
  type Equals,
  type PluginBaseline,
  type PluginErrorHandler,
  type Write,
  type WriteRecord,
} from "../index.js";
import { definePlugin, flushPlugins, refuse } from "../plugins.js";
import { dirty } from "./dirty.js";
import { history } from "./history.js";
import { mask, masked, upper } from "./mask.js";
import { persist } from "./persist.js";
import { ruled, rules } from "./rules.js";
import { rebase } from "./rebase.js";
import { arrays } from "./arrays.js";

interface Contact {
  phone: string;
  code: string;
}

const contact = (): Contact => ({ phone: "", code: "" });

const rethrow: PluginErrorHandler = (error) => {
  throw error;
};

/** A store with `plugins` on its definition. Plugin errors throw unless `onPluginError` says otherwise. */
const make = <V, const D extends Plugins>(defaultValues: V, plugins: D, onPluginError: PluginErrorHandler = rethrow) =>
  createFormsCore({ onPluginError, plugins: [arrays(), dirty()] }).define<V, never, void, undefined, unknown, D>({ defaultValues, plugins }).createStore();

/** A store as `make` makes it, with `parts` attached at the root. */
// The parts are untyped here, so they go in as any form's.
const makeWith = <V, const D extends Plugins>(defaultValues: V, plugins: D, parts: readonly Part[]) =>
  createFormsCore({ onPluginError: rethrow, plugins: [arrays(), dirty()] })
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    .define<V, never, void, undefined, unknown, D>({ defaultValues, plugins }, ...(parts as never[]))
    .createStore();

/** `code` upper-cased by a mask part. */
const upperCode = { ...masked({ clean: upper }), path: "code" };

/** A plugin that records every `onWrite` delivery it gets. */
const watcher = (name: string, when?: "sync" | "deferred" | "idle") => {
  const calls: (readonly WriteRecord[])[] = [];
  const plugin = definePlugin({ name, setup: () => ({ ...(when && { when }), onWrite: (records) => void calls.push(records) }) });
  return { plugin, calls };
};

/** A plugin that sets `value` as its meta on `phone` at setup. */
const metaAtSetup = (name: string, value: number) =>
  definePlugin({
    name,
    initialMeta: 0,
    setup: (ctx) => {
      ctx.setMeta(["phone"], value);
      return {};
    },
  });

/** Storage backed by a map. */
const memory = (saved = new Map<string, string>()) => ({
  saved,
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => void saved.set(key, value),
  removeItem: (key: string) => void saved.delete(key),
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("install", () => {
  it("runs the shared plugins first, then the definition's", () => {
    const order: string[] = [];
    const named = (name: string) =>
      definePlugin({
        name,
        setup: () => {
          order.push(name);
          return {};
        },
      });
    createFormsCore({ plugins: [arrays(), named("shared")] })
      .define({ defaultValues: contact(), plugins: [named("own")] })
      .createStore();
    expect(order).toEqual(["shared", "own"]);
  });

  it("puts each plugin's api on store.plugins under its name", () => {
    const counter = definePlugin({ name: "counter", setup: () => ({ api: { count: 3 } }) });
    const silent = definePlugin({ name: "silent", setup: () => ({}) });
    expect(make(contact(), [counter, silent]).plugins).toEqual({ counter: { count: 3 } });
    expect(make(contact(), []).plugins).toEqual({});
    expect(createFormsCore({ plugins: [arrays(), arrays()] }).define({ defaultValues: contact() }).createStore().plugins).toEqual({});
  });

  it("throws at store creation on two plugins with one name", () => {
    const one = definePlugin({ name: "one", setup: () => ({}) });
    expect(() => make(contact(), [one, one])).toThrow('Two plugins are named "one".');
  });

  it("throws at store creation on a shared and a definition plugin with one name", () => {
    const one = definePlugin({ name: "one", setup: () => ({}) });
    const form = createFormsCore({ plugins: [arrays(), one] }).define({ defaultValues: contact(), plugins: [one] });
    expect(() => form.createStore()).toThrow('Two plugins are named "one".');
  });

  it("puts the APIs of both lists on store.plugins", () => {
    const shared = definePlugin({ name: "shared", setup: () => ({ api: 1 }) });
    const own = definePlugin({ name: "own", setup: () => ({ api: 2 }) });
    const store = createFormsCore({ plugins: [arrays(), shared] }).define({ defaultValues: contact(), plugins: [own] }).createStore();
    expect(store.plugins).toEqual({ shared: 1, own: 2 });
  });

  it("throws at store creation on an `after` cycle", () => {
    const a = definePlugin({ name: "a", after: ["b"], setup: () => ({}) });
    const b = definePlugin({ name: "b", after: ["a"], setup: () => ({}) });
    expect(() => make(contact(), [a, b])).toThrow(/part of an `after` cycle/);
  });

  it("ends each error with a link to its code in development", () => {
    const one = definePlugin({ name: "one", setup: () => ({}) });
    expect(() => make(contact(), [one, one])).toThrow(
      /^@lunarhue\/forms-core: Two plugins are named "one"\. https:\/\/\S+#core:plugins:name$/,
    );
  });

  it("throws the package, a short code and its value in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const one = definePlugin({ name: "one", setup: () => ({}) });
      expect(() => make(contact(), [one, one])).toThrow(/^@lunarhue\/forms-core: plugins:name one$/);
      const a = definePlugin({ name: "a", after: ["b"], setup: () => ({}) });
      const b = definePlugin({ name: "b", after: ["a"], setup: () => ({}) });
      expect(() => make(contact(), [a, b])).toThrow(/^@lunarhue\/forms-core: plugins:cycle a$/);
      const { rebase: api } = make(contact(), [rebase()]).plugins;
      expect(() => api(make(contact(), []).root, contact(), () => "keep")).toThrow(/^@lunarhue\/forms-core: rebase:store$/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("warns in development when the plugins come from two copies of core", () => {
    const warn = vi.fn<(message: string) => void>();
    vi.stubGlobal("console", { warn });
    const one = definePlugin({ name: "one", setup: () => ({}) });
    const two = definePlugin({ name: "two", setup: () => ({}) });
    make(contact(), [one, two]);
    expect(warn).not.toHaveBeenCalled();
    // Another copy's plugin carries that copy's host.
    const host = two["~host"];
    if (!host) throw new Error("definePlugin gives every plugin a host");
    const copy = { ...two, "~host": (...args: Parameters<typeof host>) => host(...args) };
    make(contact(), [one, copy]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /^@lunarhue\/forms-core: This store's plugins come from two copies of @lunarhue\/forms-core\. Install one copy\. https:\/\/\S+#core:plugins:copies$/,
      ),
    );
  });

  it("ignores a name in `after` that isn't installed", () => {
    const lonely = definePlugin({
      name: "lonely",
      after: ["missing"],
      setup: () => ({ beforeWrite: (write) => `${String(write.value)}!` }),
    });
    const store = make(contact(), [lonely]);
    store.root.at("code").setValue("a");
    expect(store.root.at("code").peek().value).toBe("a!");
  });
});

describe("beforeWrite", () => {
  it("runs in `after` order, and each plugin sees the caller's input", () => {
    const seen: unknown[] = [];
    const tag = definePlugin({
      name: "tag",
      setup: () => ({
        beforeWrite(write) {
          seen.push({ input: write.input, value: write.value });
          return `x-${String(write.value)}`;
        },
      }),
    });
    // Installed first, but runs after `tag`.
    const late = makeWith(contact(), [{ ...mask(), after: ["tag"] }, tag], [upperCode]);
    late.root.at("code").setValue("ab");
    expect(late.root.at("code").peek().value).toBe("X-AB");
    expect(seen).toEqual([{ input: "ab", value: "ab" }]);

    seen.length = 0;
    const early = makeWith(contact(), [mask(), tag], [upperCode]);
    early.root.at("code").setValue("ab");
    expect(early.root.at("code").peek().value).toBe("x-AB");
    expect(seen).toEqual([{ input: "ab", value: "AB" }]);
  });

  it("stops a refused write, which changes nothing and marks nothing edited", () => {
    const store = make(contact(), [definePlugin({ name: "lock", setup: () => ({ beforeWrite: () => refuse }) })]);
    const runs = vi.fn<() => void>();
    store.subscribe(["phone"], runs);
    store.root.at("phone").setValue("1");
    expect(store.root.at("phone").peek()).toMatchObject({ value: "", edited: false });
    expect(runs).not.toHaveBeenCalled();
  });

  it("gets a frozen write", () => {
    let frozen = false;
    const store = make(contact(), [
      definePlugin({ name: "look", setup: () => ({ beforeWrite: (write) => ((frozen = Object.isFrozen(write)), write.value) }) }),
    ]);
    store.root.at("phone").setValue("1");
    expect(frozen).toBe(true);
  });

  it("sees each row push and insert add as a write at the row's path, and stores the row it returns", () => {
    const writes: Write[] = [];
    const tag = definePlugin({
      name: "tag",
      setup: () => ({ beforeWrite: (write) => (writes.push(write), `${String(write.value)}!`) }),
    });
    const { plugin, calls } = watcher("watch");
    const store = make({ tags: ["a"] }, [tag, plugin]);
    const tags = store.root.at("tags");
    tags.push("b");
    tags.insert(0, "c");
    expect(tags.peek().value).toEqual(["c!", "a", "b!"]);
    const [c, , b] = tags.peek().keys;
    expect(writes).toEqual([
      { path: ["tags", b], input: "b", value: "b", before: undefined, cause: "user" },
      { path: ["tags", c], input: "c", value: "c", before: undefined, cause: "user" },
    ]);
    // The record has the row the store took.
    expect(calls.flat().map((record) => record.type === "insert" && record.item)).toEqual(["b!", "c!"]);
  });

  it("takes a refused row out again, with no record and nothing edited", () => {
    const { plugin, calls } = watcher("watch");
    const lock = definePlugin({ name: "lock", setup: () => ({ beforeWrite: (write) => (write.value === "no" ? refuse : write.value) }) });
    const store = make({ tags: ["a", "b"] }, [lock, plugin]);
    const tags = store.root.at("tags");
    const before = tags.peek();
    tags.insert(1, "no");
    expect(tags.peek()).toMatchObject({ value: ["a", "b"], keys: before.keys, edited: false });
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(calls).toEqual([]);
    tags.push("yes");
    expect(tags.peek().value).toEqual(["a", "b", "yes"]);
    expect(tags.peek().keys.slice(0, 2)).toEqual(before.keys);
  });

  it("sees a write of an object once, at the object's path", () => {
    const paths: unknown[] = [];
    const look = definePlugin({ name: "look", setup: () => ({ beforeWrite: (write) => (paths.push(write.path), write.value) }) });
    const store = make({ address: { zip: "" } }, [look]);
    store.root.at("address").setValue({ zip: "1" });
    store.root.setValue({ address: { zip: "2" } }, { replace: true });
    expect(paths).toEqual([["address"], []]);
  });
});

describe("records", () => {
  it("are frozen, as is the list", () => {
    const { plugin, calls } = watcher("watch");
    const store = make(contact(), [plugin]);
    store.root.at("phone").setValue("1");
    const [records] = calls;
    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records?.[0])).toBe(true);
  });

  it("cover value, array and flag writes", () => {
    const { plugin, calls } = watcher("watch");
    const store = make({ tags: ["a", "b"] }, [plugin]);
    const tags = store.root.at("tags");
    const [a, b] = tags.peek().keys;
    store.batch(() => {
      tags.push("c");
      tags.move(0, 5);
      tags.remove(0);
      tags.setTouched();
      tags.setDisabled(true);
      tags.setReadOnly(true);
    });
    const [c] = tags.peek().keys;
    expect(calls).toHaveLength(1);
    const path = ["tags"];
    expect(calls[0]).toEqual([
      { type: "insert", path, before: ["a", "b"], after: ["a", "b", "c"], index: 2, key: c, item: "c", cause: "user" },
      { type: "move", path, before: ["a", "b", "c"], after: ["b", "c", "a"], from: 0, to: 2, cause: "user" },
      { type: "remove", path, before: ["b", "c", "a"], after: ["c", "a"], index: 0, key: b, item: "b", cause: "user" },
      { type: "touched", path, before: false, after: true, cause: "user" },
      { type: "disabled", path, before: false, after: true, cause: "user" },
      { type: "readOnly", path, before: false, after: true, cause: "user" },
    ]);
    expect(store.root.at("tags").peek().keys).toEqual([c, a]);
  });

  it("name reset and rebase as their cause", () => {
    const { plugin, calls } = watcher("watch");
    const causes: Write["cause"][] = [];
    const look = definePlugin({ name: "look", setup: () => ({ beforeWrite: (write) => (causes.push(write.cause), write.value) }) });
    const store = make(contact(), [plugin, look, rebase()]);
    store.root.at("phone").setValue("1");
    store.reset();
    store.plugins.rebase(store.root, { phone: "2", code: "" }, () => "take");
    expect(calls.map((records) => records.map((record) => record.cause))).toEqual([["user"], ["reset"], ["rebase"]]);
    expect(causes).toEqual(["user", "reset", "rebase"]);
  });

  it('take the cause a plugin passes to ctx.write, which can only be "rebase"', () => {
    const { plugin, calls } = watcher("watch");
    let write: ((cause: unknown) => void) | undefined;
    const writer = definePlugin({
      name: "rebase",
      setup: (ctx) => {
        // Cast past the types, as untyped code could.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        write = (cause) => ctx.write(() => ctx.store.root.at("phone").setValue(String(cause), { edited: false }), cause as "rebase");
        return {};
      },
    });
    make(contact(), [plugin, writer]);
    for (const cause of [undefined, "rebase", "user", "reset", { plugin: "watch" }]) write?.(cause);
    expect(calls.map((records) => records.map((record) => record.cause))).toEqual([
      [{ plugin: "rebase" }],
      ["rebase"],
      [{ plugin: "rebase" }],
      [{ plugin: "rebase" }],
      [{ plugin: "rebase" }],
    ]);
  });
});

/** A plugin that hands out its context's baseline, for tests of `ctx.baseline`. */
const outside = () => {
  let baseline: PluginBaseline | undefined;
  const plugin = definePlugin({
    name: "outside",
    setup(ctx) {
      baseline = ctx.baseline;
      return {};
    },
  });
  return { plugin, baseline: () => baseline };
};

/** Compares strings with their ends trimmed. */
const trimmed: Equals = (a, b, _ctx, next) => (typeof a === "string" && typeof b === "string" ? a.trim() === b.trim() : next(a, b));

describe("the baseline on the context", () => {
  it("reads the baseline with each array's pairing, and nothing at a removed item", () => {
    const { plugin, baseline } = outside();
    const store = make({ name: "a", tags: ["x", "y"] }, [plugin]);
    const tags = store.root.at("tags");
    tags.move(0, 1);
    expect(baseline()?.read([])).toEqual({ value: { name: "a", tags: ["x", "y"] }, keys: undefined });
    expect(baseline()?.read(["tags"])).toEqual({ value: ["x", "y"], keys: ["k0", "k1"] });
    expect(baseline()?.read(["tags", "k1"])).toEqual({ value: "y", keys: undefined });
    tags.remove(0);
    expect(baseline()?.read(["tags", "k1"])).toBeUndefined();
  });

  it("compares with the form's equals", () => {
    const { plugin, baseline } = outside();
    createFormsCore({ plugins: [arrays(), arrays()] }).define({ defaultValues: { name: "" }, plugins: [plugin, dirty()], equals: trimmed }).createStore();
    expect(baseline()?.equals(["name"], "a ", "a")).toBe(true);
    expect(baseline()?.equals(["name"], "a", "b")).toBe(false);
  });

  it("moves the baseline in one wake, and writes no value", () => {
    const { plugin, baseline } = outside();
    const { plugin: watch, calls } = watcher("watch");
    const store = make({ name: "a", tags: ["x", "y"] }, [plugin, watch]);
    store.root.at("name").setValue("b");
    let runs = 0;
    store.subscribeForm(() => void runs++);
    store.batch(() => baseline()?.move([], { name: "b", tags: ["x", "y"] }));
    expect(runs).toBe(1);
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(store.getSnapshot(["name"]).edited).toBe(true);
    expect(calls.flat().map((record) => record.cause)).toEqual(["user"]);
    store.reset();
    expect(store.getSnapshot([]).value).toEqual({ name: "b", tags: ["x", "y"] });
  });

  it("pairs arrays with the current items, or keeps the old pairing where asked", () => {
    const { plugin, baseline } = outside();
    const store = make({ a: ["x", "y"], b: ["x", "y"] }, [plugin]);
    store.root.at("a").move(0, 1);
    store.root.at("b").move(0, 1);
    baseline()?.move([], { a: ["X", "Y"], b: ["X", "Y"] }, (path) => path[0] === "b");
    // a pairs by index with its current items k1, k0. b keeps k0, k1.
    expect(baseline()?.read(["a"])?.keys).toEqual(["k1", "k0"]);
    expect(baseline()?.read(["b"])?.keys).toEqual(["k0", "k1"]);
    expect(store.changes(["b", "k0"])).toEqual([{ path: ["b", "k0"], baseline: "X", value: "x" }]);
  });

  it("pairs an array with the keys a key list gives", () => {
    const { plugin, baseline } = outside();
    const store = make({ tags: ["x", "y"] }, [plugin]);
    const tags = store.root.at("tags");
    tags.insert(0, "w");
    tags.remove(2);
    // Now w, x with keys k2, k0. The list pairs X with k0 and Y with k1, which no current item has.
    baseline()?.move([], { tags: ["X", "Y"] }, (path) => (path[0] === "tags" ? ["k0", "k1"] : false));
    expect(baseline()?.read(["tags"])?.keys).toEqual(["k0", "k1"]);
    expect(store.changes(["tags"])).toEqual([{ path: ["tags"], baseline: ["X", "Y"], value: ["w", "x"] }]);
    expect(store.getSnapshot(["tags", "k2"]).dirty).toBe(true);
    expect(store.changes(["tags", "k0"])).toEqual([{ path: ["tags", "k0"], baseline: "X", value: "x" }]);
    store.reset();
    expect(store.getSnapshot([]).value).toEqual({ tags: ["X", "Y"] });
  });
});

describe("isolation", () => {
  it("queues a plugin's write until every plugin in the round has run", () => {
    const seenByB: { records: readonly WriteRecord[]; code: unknown }[] = [];
    // A answers every user write to `phone` by copying it into `code`.
    const a = definePlugin({
      name: "a",
      setup: (ctx) => ({
        onWrite(records) {
          for (const record of records)
            if (record.cause === "user" && record.path[0] === "phone" && record.type === "value")
              ctx.write(() => ctx.store.root.at("code").setValue(record.after));
        },
      }),
    });
    const b = definePlugin({
      name: "b",
      setup: (ctx) => ({
        onWrite: (records) => void seenByB.push({ records, code: ctx.store.getSnapshot(["code"]).value }),
      }),
    });
    const store = make(contact(), [a, b]);
    store.root.at("phone").setValue("5");
    // Round one: B gets the user's record, and A's write hasn't happened yet.
    expect(seenByB[0]).toEqual({ records: [{ type: "value", path: ["phone"], before: "", after: "5", cause: "user" }], code: "" });
    // Round two: A's write, with A as its cause.
    expect(seenByB[1]?.records).toEqual([{ type: "value", path: ["code"], before: "", after: "5", cause: { plugin: "a" } }]);
    expect(store.root.at("code").peek().value).toBe("5");
  });

  it("lands queued writes before listeners run, so they run once", () => {
    const copy = definePlugin({
      name: "copy",
      setup: (ctx) => ({
        onWrite(records) {
          if (records.some((record) => record.path[0] === "phone")) ctx.write(() => ctx.store.root.at("code").setValue("copied"));
        },
      }),
    });
    const store = make(contact(), [copy]);
    const seen: unknown[] = [];
    store.subscribe([], () => seen.push(store.getSnapshot([]).value));
    store.root.at("phone").setValue("1");
    expect(seen).toEqual([{ phone: "1", code: "copied" }]);
  });

  it("lands meta set inside a hook with the queued writes, after the round", () => {
    const seenByB: unknown[] = [];
    const a = definePlugin({
      name: "a",
      initialMeta: "",
      initialFormMeta: "",
      setup: (ctx) => ({
        onWrite() {
          ctx.setMeta(["phone"], "seen");
          ctx.setFormMeta("seen");
        },
      }),
    });
    const b = definePlugin({
      name: "b",
      setup: (ctx) => ({ onWrite: () => void seenByB.push(ctx.store.getSnapshot(["phone"]).meta) }),
    });
    const store = make(contact(), [a, b]);
    const runs = vi.fn<() => void>();
    store.subscribe(["phone"], runs);
    store.root.at("phone").setValue("1");
    expect(seenByB).toEqual([undefined]);
    expect(store.root.at("phone").peek().meta).toEqual({ a: "seen" });
    expect(store.getFormSnapshot().meta).toEqual({ a: "seen" });
    expect(runs).toHaveBeenCalledOnce();
  });

  it("stops two plugins that keep answering each other", () => {
    const errors: [unknown, string][] = [];
    let n = 0;
    const answer = (name: string, path: keyof Contact) =>
      definePlugin({
        name,
        setup: (ctx) => ({
          onWrite() {
            ctx.write(() => ctx.store.root.at(path).setValue(String(++n)));
          },
        }),
      });
    const store = make(contact(), [answer("ping", "phone"), answer("pong", "code")], (error, plugin) => errors.push([error, plugin]));
    store.root.at("phone").setValue("start");
    expect(errors).toHaveLength(1);
    expect(String(errors[0]?.[0])).toMatch(/kept answering each other's writes for 10 rounds: ping, pong/);
    expect(errors[0]?.[1]).toBe("ping, pong");
    // The store still works.
    store.root.at("code").setValue("after");
    expect(store.root.at("code").peek().value).not.toBe("");
    // Production keeps the names after the code.
    vi.stubEnv("NODE_ENV", "production");
    try {
      store.root.at("phone").setValue("again");
      expect(String(errors[errors.length - 1]?.[0])).toMatch(/^Error: @lunarhue\/forms-core: plugins:loop ping, pong$/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("reports a throwing hook, and the write and the other plugins carry on", () => {
    const errors: [string, string][] = [];
    const broken = definePlugin({
      name: "broken",
      setup: () => ({
        beforeWrite() {
          throw new Error("before");
        },
        onWrite() {
          throw new Error("after");
        },
      }),
    });
    const { plugin, calls } = watcher("fine");
    const store = make(contact(), [broken, plugin], (error, name) => errors.push([String(error), name]));
    store.root.at("phone").setValue("1");
    expect(store.root.at("phone").peek().value).toBe("1");
    expect(calls).toHaveLength(1);
    expect(errors).toEqual([
      ["Error: before", "broken"],
      ["Error: after", "broken"],
    ]);
  });

  it("reports a throwing setup, and the store works without that plugin's hooks", () => {
    const errors: string[] = [];
    const broken = definePlugin({
      name: "broken",
      setup: () => {
        throw new Error("setup");
      },
    });
    const store = make(contact(), [broken], (_, name) => errors.push(name));
    store.root.at("phone").setValue("1");
    expect(errors).toEqual(["broken"]);
    expect(store.root.at("phone").peek().value).toBe("1");
  });

  it("throws a hook's error on a later task by default", () => {
    vi.useFakeTimers();
    const broken = definePlugin({
      name: "broken",
      setup: () => ({
        onWrite() {
          throw new Error("late");
        },
      }),
    });
    const store = createFormsCore({ plugins: [arrays(), arrays()] }).define({ defaultValues: contact(), plugins: [broken] }).createStore();
    store.root.at("phone").setValue("1");
    expect(store.root.at("phone").peek().value).toBe("1");
    expect(() => vi.runAllTimers()).toThrow("late");
  });

  it("refuses a direct store write from inside a hook, setup included", () => {
    const errors: unknown[] = [];
    const rude = definePlugin({
      name: "rude",
      setup: (ctx) => {
        ctx.store.root.at("code").setValue("setup");
        return {};
      },
    });
    const ruder = definePlugin({
      name: "ruder",
      setup: (ctx) => ({
        onWrite() {
          ctx.store.root.at("code").setTouched();
        },
      }),
    });
    const store = make(contact(), [rude, ruder], (error) => errors.push(error));
    store.root.at("phone").setValue("1");
    const wrote = /^Error: @lunarhue\/forms-core: A plugin wrote to the store from inside a hook\. Write through `ctx\.write`\. https:\/\/\S+#core:plugins:write$/;
    expect(errors.map(String)).toEqual([expect.stringMatching(wrote), expect.stringMatching(wrote)]);
    expect(store.root.at("code").peek()).toMatchObject({ value: "", touched: false });
  });

  it("gives each plugin its own meta slot, frozen", () => {
    const store = make(contact(), [metaAtSetup("own", 1), metaAtSetup("other", 2)]);
    const meta = store.root.at("phone").peek().meta;
    expect(meta).toEqual({ own: 1, other: 2 });
    expect(Object.isFrozen(meta)).toBe(true);
  });

  it("leaves `meta` off a snapshot no plugin set it on", () => {
    const store = make(contact(), [definePlugin({ name: "none", setup: () => ({}) })]);
    expect("meta" in store.root.at("phone").peek()).toBe(false);
    expect("meta" in store.getFormSnapshot()).toBe(false);
  });

  it("fires the path's listeners when meta changes, and not when it is set to the same value", () => {
    const meta = definePlugin({ name: "m", initialMeta: 0, setup: (ctx) => ({ api: { set: (value: number) => ctx.setMeta(["phone"], value) } }) });
    const store = make(contact(), [meta]);
    const runs = vi.fn<() => void>();
    store.subscribe(["phone"], runs);
    store.plugins.m.set(1);
    store.plugins.m.set(1);
    expect(runs).toHaveBeenCalledOnce();
  });
});

describe("timing", () => {
  it("runs plugins in `after` order for every hook", () => {
    const order: string[] = [];
    const logger = (name: string, after?: readonly string[]) =>
      definePlugin({ name, ...(after && { after }), setup: () => ({ onWrite: () => void order.push(name) }) });
    const store = make(contact(), [logger("c", ["b"]), logger("a"), logger("b", ["a"])]);
    store.root.at("phone").setValue("1");
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("delivers `sync` records once at the end of the outermost batch, before listeners", () => {
    const log: string[] = [];
    const sync = definePlugin({ name: "s", setup: () => ({ onWrite: (records) => void log.push(`sync ${records.length}`) }) });
    const store = make(contact(), [sync]);
    store.subscribe(["phone"], () => log.push("listener"));
    store.batch(() => {
      store.root.at("phone").setValue("1");
      store.batch(() => store.root.at("code").setValue("2"));
      log.push("batch end");
    });
    expect(log).toEqual(["batch end", "sync 2", "listener"]);
  });

  it("delivers `deferred` records once per task on a microtask", async () => {
    const { plugin, calls } = watcher("watch", "deferred");
    const store = make({ rows: Array.from({ length: 1000 }, () => "") }, [plugin]);
    const list = store.root.at("rows");
    store.batch(() => {
      for (const key of list.peek().keys) list.item(key).setValue("x");
    });
    store.root.at("rows").push("y");
    expect(calls).toEqual([]);
    await Promise.resolve();
    expect(calls.map((records) => records.length)).toEqual([1001]);
  });

  it("delivers `idle` records on a timer without `scheduler.postTask`", () => {
    vi.useFakeTimers();
    const { plugin, calls } = watcher("watch", "idle");
    const store = make(contact(), [plugin]);
    store.root.at("phone").setValue("1");
    store.root.at("phone").setValue("2");
    expect(vi.getTimerCount()).toBe(1);
    vi.runAllTimers();
    expect(calls.map((records) => records.length)).toEqual([2]);
  });

  it("delivers `idle` records through `scheduler.postTask` at background priority when there is one", () => {
    const tasks: (() => void)[] = [];
    const postTask = vi.fn<(task: () => void) => void>((task) => void tasks.push(task));
    vi.stubGlobal("scheduler", { postTask });
    const { plugin, calls } = watcher("watch", "idle");
    const store = make(contact(), [plugin]);
    store.root.at("phone").setValue("1");
    expect(postTask).toHaveBeenCalledWith(expect.any(Function), { priority: "background" });
    expect(calls).toEqual([]);
    for (const task of tasks) task();
    expect(calls).toHaveLength(1);
  });

  it("delivers waiting records at once with flushPlugins and ctx.flush, and not again later", async () => {
    vi.useFakeTimers();
    const deferred = watcher("d", "deferred");
    const idle = watcher("i", "idle");
    const flusher = definePlugin({ name: "flusher", setup: (ctx) => ({ api: { flush: () => ctx.flush() } }) });
    const store = make(contact(), [deferred.plugin, idle.plugin, flusher]);
    store.root.at("phone").setValue("1");
    flushPlugins(store);
    expect([deferred.calls.length, idle.calls.length]).toEqual([1, 1]);
    store.root.at("phone").setValue("2");
    store.plugins.flusher.flush();
    expect([deferred.calls.length, idle.calls.length]).toEqual([2, 2]);
    await Promise.resolve();
    vi.runAllTimers();
    expect([deferred.calls.length, idle.calls.length]).toEqual([2, 2]);
  });

  it("flushes without history or persist, when no installed plugin brings the timings", async () => {
    vi.useFakeTimers();
    const flusher = definePlugin({ name: "flusher", setup: (ctx) => ({ api: { flush: () => ctx.flush() } }) });
    const store = makeWith(contact(), [mask()], [upperCode]);
    store.root.at("code").setValue("ab");
    expect(() => flushPlugins(store)).not.toThrow();
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
    expect(store.root.at("code").peek().value).toBe("AB");
    // The public `definePlugin` brings the timings, so its `ctx.flush` works next to them.
    const withFlusher = makeWith(contact(), [mask(), flusher], [upperCode]);
    withFlusher.root.at("code").setValue("ab");
    expect(() => withFlusher.plugins.flusher.flush()).not.toThrow();
  });

  it("flushes history and persist when a plugin before them brings no timings", () => {
    vi.useFakeTimers();
    const storage = memory();
    const store = makeWith(contact(), [mask(), history(), persist("contact", storage)], [upperCode]);
    store.root.at("code").setValue("ab");
    flushPlugins(store);
    expect(JSON.parse(storage.saved.get("contact") ?? "null")).toEqual({ phone: "", code: "AB" });
    expect(store.plugins.history.undo()).toBe(true);
    expect(store.root.at("code").peek().value).toBe("");
  });

  it("schedules nothing for a timing no plugin uses", () => {
    vi.useFakeTimers();
    const { plugin } = watcher("watch", "sync");
    const store = make(contact(), [plugin]);
    store.root.at("phone").setValue("1");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("runs writes a `deferred` observer queued in a batch of their own", async () => {
    const echo = definePlugin({
      name: "echo",
      setup: (ctx) => ({
        when: "deferred",
        onWrite(records) {
          if (records.some((record) => record.cause === "user")) ctx.write(() => ctx.store.root.at("code").setValue("echo"));
        },
      }),
    });
    const store = make(contact(), [echo]);
    store.root.at("phone").setValue("1");
    expect(store.root.at("code").peek().value).toBe("");
    await Promise.resolve();
    expect(store.root.at("code").peek().value).toBe("echo");
  });
});

/** A captcha plugin: it asks `fetchToken` for a token on submit and refuses the submit when that fails. */
const captcha = (fetchToken: () => Promise<string>) =>
  definePlugin({
    name: "captcha",
    setup: (ctx) => ({
      async onSubmit() {
        try {
          const token = await fetchToken();
          ctx.write(() => ctx.store.root.at("code").setValue(token, { edited: false }));
          return undefined;
        } catch {
          ctx.store.root.setErrors({ message: "Couldn't check you're human. Try again." });
          return refuse;
        }
      },
    }),
  });

describe("reset and submit", () => {
  it("calls onReset inside the reset's batch, after the values went back", () => {
    const seen: unknown[] = [];
    const watch = definePlugin({
      name: "watch",
      initialFormMeta: "",
      setup: (ctx) => ({
        onReset(path) {
          seen.push({ path, value: ctx.store.getSnapshot([]).value });
          ctx.setFormMeta("reset");
        },
      }),
    });
    const store = make(contact(), [watch]);
    store.root.at("phone").setValue("1");
    const runs = vi.fn<() => void>();
    store.subscribeForm(runs);
    store.reset();
    store.root.at("code").reset();
    expect(seen).toEqual([
      { path: [], value: { phone: "", code: "" } },
      { path: ["code"], value: { phone: "", code: "" } },
    ]);
    expect(store.getFormSnapshot().meta).toEqual({ watch: "reset" });
    // Once per reset, for the dirty flag and the meta together. The field reset changes nothing on the form.
    expect(runs).toHaveBeenCalledOnce();
  });

  it("waits for onSubmit before onSubmit of the definition, and tells onSubmitted how it ended", async () => {
    const order: string[] = [];
    const upload = definePlugin({
      name: "upload",
      setup: () => ({
        async onSubmit() {
          await Promise.resolve();
          await Promise.resolve();
          order.push("upload done");
        },
        onSubmitted: (submission) => void order.push(submission.status),
      }),
    });
    const store = createFormsCore({ plugins: [arrays(), arrays()] })
      .define({ defaultValues: contact(), plugins: [upload], onSubmit: () => void order.push("onSubmit") })
      .createStore();
    await store.submit();
    expect(order).toEqual(["upload done", "onSubmit", "succeeded"]);
  });

  it("tells onSubmitted about an invalid submit too", async () => {
    const ended: string[] = [];
    const plugin = definePlugin({ name: "end", setup: () => ({ onSubmitted: (submission) => void ended.push(submission.status) }) });
    const store = createFormsCore({ plugins: [arrays(), arrays()] })
      .define({
        defaultValues: contact(),
        plugins: [plugin],
        validate: { fields: { phone: (value) => (value === "" ? { message: "Required" } : undefined) } },
      })
      .createStore();
    await store.submit();
    expect(ended).toEqual(["invalid"]);
  });

  it("gives onSubmitted the value onSubmit got as ctx.input, with edits made while validation ran", async () => {
    const ended: [string, unknown][] = [];
    const end = definePlugin({ name: "end", setup: () => ({ onSubmitted: (submission, input) => void ended.push([submission.status, input]) }) });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let sent: unknown;
    let fail = false;
    const store = createFormsCore({ plugins: [arrays(), arrays()] })
      .define({
        defaultValues: contact(),
        plugins: [end],
        validate: { fields: { code: () => gate.then(() => undefined) } },
        onSubmit: (_value, ctx) => {
          sent = ctx.input;
          if (fail) throw new Error("down");
        },
      })
      .createStore();
    const done = store.submit();
    await Promise.resolve();
    store.root.at("phone").setValue("typed while validating");
    release();
    await done;
    expect(sent).toEqual({ phone: "typed while validating", code: "" });
    fail = true;
    await store.submit();
    expect(ended).toEqual([
      ["succeeded", sent],
      ["failed", sent],
    ]);
    expect(ended[0]?.[1]).toBe(sent);
  });

  it("gives onSubmitted no value when the submit ends invalid", async () => {
    const inputs: unknown[] = [];
    const end = definePlugin({ name: "end", setup: () => ({ onSubmitted: (_submission, input) => void inputs.push(input) }) });
    const store = createFormsCore({ plugins: [arrays(), arrays()] })
      .define({ defaultValues: contact(), plugins: [end], validate: { fields: { phone: (value) => (value === "" ? { message: "Required" } : undefined) } } })
      .createStore();
    await store.submit();
    expect(inputs).toEqual([undefined]);
  });

  it("reports a rejected onSubmit and submits anyway", async () => {
    const errors: [unknown, string][] = [];
    const failing = definePlugin({ name: "failing", setup: () => ({ onSubmit: () => Promise.reject(new Error("upload failed")) }) });
    const onSubmit = vi.fn<() => string>(() => "sent");
    const store = createFormsCore({ onPluginError: (error, name) => errors.push([error, name]) })
      .define({ defaultValues: contact(), plugins: [failing], onSubmit })
      .createStore();
    expect(await store.submit()).toEqual({ status: "succeeded", result: "sent" });
    expect(errors.map(([error, name]) => [String(error), name])).toEqual([["Error: upload failed", "failing"]]);
  });

  it("lets a plugin refuse a submit, which ends as a failed validation does", async () => {
    const ended: string[] = [];
    const end = definePlugin({ name: "end", setup: () => ({ onSubmitted: (submission) => void ended.push(submission.status) }) });
    const onSubmit = vi.fn<() => string>(() => "sent");
    const store = createFormsCore({ plugins: [arrays(), arrays()] })
      .define({ defaultValues: contact(), plugins: [captcha(() => Promise.reject(new Error("offline"))), end], onSubmit })
      .createStore();
    expect(await store.submit()).toEqual({ status: "invalid" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(ended).toEqual(["invalid"]);
    expect(store.getSnapshot([]).shownErrors).toEqual([{ message: "Couldn't check you're human. Try again." }]);
    expect(store.getFormSnapshot()).toMatchObject({ submitting: false, submitCount: 1 });
  });

  it("submits when the plugin gets its token, and the token isn't a user edit", async () => {
    const onSubmit = vi.fn<(value: Contact) => string>(() => "sent");
    const store = createFormsCore({ plugins: [arrays(), arrays()] })
      .define({ defaultValues: contact(), plugins: [captcha(() => Promise.resolve("t0k"))], onSubmit })
      .createStore();
    expect(await store.submit()).toEqual({ status: "succeeded", result: "sent" });
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ phone: "", code: "t0k" });
    expect(store.getSnapshot(["code"]).edited).toBe(false);
  });

  it("skips the onSubmit of later plugins after a refusal returned at once", async () => {
    const later = vi.fn<() => void>();
    const store = createFormsCore({ plugins: [arrays(), arrays()] })
      .define({
        defaultValues: contact(),
        plugins: [
          definePlugin({ name: "no", setup: () => ({ onSubmit: () => refuse }) }),
          definePlugin({ name: "later", setup: () => ({ onSubmit: later }) }),
        ],
      })
      .createStore();
    expect(await store.submit()).toEqual({ status: "invalid" });
    expect(later).not.toHaveBeenCalled();
  });
});

interface Shipment {
  sameAsBilling: boolean;
  shipping: { street: string };
}

const shipment = (): Shipment => ({ sameAsBilling: true, shipping: { street: "" } });

const shippingRules = ruled<Shipment>({ shipping: (value) => ({ disabled: value.sameAsBilling, hidden: value.sameAsBilling }) });

describe("setup and server rendering", () => {
  /** A plugin that writes the street and sets form meta in its setup. */
  const writesAtSetup = definePlugin({
    name: "form",
    initialFormMeta: false,
    setup: (ctx) => {
      ctx.write(() => ctx.store.root.at("shipping").at("street").setValue("1 Main St", { edited: false }));
      ctx.setFormMeta(true);
      return {};
    },
  });

  it("puts what setup wrote in the server snapshots, the same objects the store reads now", () => {
    const store = makeWith(shipment(), [rules(), writesAtSetup], [shippingRules]);
    const shipping = store.getSnapshot(["shipping"]);
    expect(shipping).toMatchObject({ disabled: true, meta: { rules: { hidden: true } }, value: { street: "1 Main St" } });
    expect(store.getServerSnapshot(["shipping"])).toBe(shipping);
    expect(store.getServerFormSnapshot()).toBe(store.getFormSnapshot());
    expect(store.getServerFormSnapshot().meta).toEqual({ form: true });
    // So does a field below it.
    expect(store.getServerSnapshot(["shipping", "street"])).toMatchObject({ value: "1 Main St", disabled: true });
  });

  it("keeps today's baseline: a value written in setup is dirty against the defaults", () => {
    const store = make(shipment(), [writesAtSetup]);
    expect(store.getFormSnapshot().dirty).toBe(true);
    expect(store.getServerFormSnapshot().dirty).toBe(true);
    expect(store.getSnapshot(["shipping", "street"]).edited).toBe(false);
  });

  it("keeps the server snapshots once the store is written to", () => {
    const store = makeWith(shipment(), [rules()], [shippingRules]);
    const server = store.getServerSnapshot(["shipping"]);
    store.root.at("sameAsBilling").setValue(false);
    expect(store.getSnapshot(["shipping"]).disabled).toBe(false);
    expect(store.getServerSnapshot(["shipping"])).toBe(server);
    expect(store.getServerSnapshot(["shipping"]).disabled).toBe(true);
  });

  it("makes no records for setup's writes, so a store never written to schedules nothing", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("localStorage", memory(new Map([["order", '{"sameAsBilling":false}']])));
    const deferred = watcher("deferred", "deferred");
    const idle = watcher("idle", "idle");
    const sync = watcher("sync");
    const store = makeWith(shipment(), [rules(), writesAtSetup, history(), persist("order"), deferred.plugin, idle.plugin, sync.plugin], [shippingRules]);
    expect(store.getSnapshot(["shipping"]).disabled).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
    expect([deferred.calls, idle.calls, sync.calls]).toEqual([[], [], []]);
    // Nothing waits either: a flush finds no records.
    flushPlugins(store);
    expect([deferred.calls, idle.calls]).toEqual([[], []]);
    // Nothing read storage: persist restores at the first listener.
    expect(store.getSnapshot(["sameAsBilling"]).value).toBe(true);
  });
});

interface Parcel {
  note: string;
  shipping: { street: string; city: string };
  rows: { t: string }[];
}

const parcel = (): Parcel => ({ note: "", shipping: { street: "", city: "Oslo" }, rows: [{ t: "a" }, { t: "b" }, { t: "c" }] });

/** Writes the whole `shipping` object and drops the first row, so no node below either is made in setup. */
const fills = definePlugin({
  name: "fill",
  requires: () => [arrays],
  setup: (ctx) => {
    ctx.write(() => {
      ctx.store.root.at("shipping").setValue({ street: "1 Main St", city: "Oslo" }, { edited: false });
      ctx.store.root.at("rows").remove(0, { edited: false });
    });
    return {};
  },
});

// `server` is read before any write, the way the server renders. `client`
// has a write first, so the field is made after the store changed.
function both(path: string[]) {
  const server = make(parcel(), [fills]);
  const client = make(parcel(), [fills]);
  client.root.at("note").setValue("typed");
  return { server: server.getServerSnapshot(path), client: client.getServerSnapshot(path) };
}

describe("server snapshot of a field first read after a write, when setup wrote above it", () => {
  it("is dirty for a child whose value setup changed", () => {
    const { server, client } = both(["shipping", "street"]);
    expect(server).toMatchObject({ value: "1 Main St", dirty: true });
    expect(client).toEqual(server);
  });

  it("is clean for a child whose value setup kept", () => {
    const { server, client } = both(["shipping", "city"]);
    expect(server).toMatchObject({ value: "Oslo", dirty: false });
    expect(client).toEqual(server);
  });

  it("finds an item by the key it had after setup, not by its starting position", () => {
    const { server, client } = both(["rows", "k1", "t"]);
    expect(server).toMatchObject({ value: "b", name: "rows.0.t", dirty: false });
    expect(client).toEqual(server);
    expect(both(["rows", "k1"]).client).toEqual(both(["rows", "k1"]).server);
    expect(both(["rows", "k0", "t"]).client).toEqual(both(["rows", "k0", "t"]).server);
  });

  it("keeps the item's place after setup when the user moves items before it is read", () => {
    const store = make(parcel(), [fills]);
    store.root.at("rows").move(0, 1);
    expect(store.getServerSnapshot(["rows", "k2", "t"])).toMatchObject({ value: "c", name: "rows.1.t" });
  });
});

describe("revalidation", () => {
  it("reruns a form validator once for every path one ctx.write changed", async () => {
    let fill: (() => void) | undefined;
    const filler = definePlugin({
      name: "filler",
      setup: (ctx) => {
        fill = () =>
          ctx.write(() => {
            ctx.store.root.at("phone").setValue("1", { edited: false });
            ctx.store.root.at("code").setValue("2", { edited: false });
          });
        return {};
      },
    });
    const form = vi.fn<(value: Contact) => undefined>(() => undefined);
    const store = createFormsCore({ plugins: [arrays(), arrays()] })
      .define({ defaultValues: contact(), validate: { form }, plugins: [filler] })
      .createStore();
    await store.validate();
    form.mockClear();
    fill?.();
    expect(form).toHaveBeenCalledTimes(1);
    expect(form.mock.calls[0]?.[0]).toEqual({ phone: "1", code: "2" });
  });
});

/** A plugin that starts the form from `value`, and pushes the value it was given to `seen`. */
const starts = (name: string, value: Contact | undefined, seen?: unknown[]) =>
  definePlugin({ name, initial: (given) => (seen?.push(given), value), setup: () => ({}) });

describe("a plugin list", () => {
  it("skips false, null and undefined", () => {
    const counter = definePlugin({ name: "counter", setup: () => ({ api: { count: 1 } }) });
    const store = createFormsCore({ plugins: [arrays(), false, counter, null] })
      .define({ defaultValues: contact(), plugins: [undefined] })
      .createStore();
    expect(store.plugins).toEqual({ counter: { count: 1 } });
  });
});

describe("initial", () => {
  it("starts the store, its baseline and its server snapshot from the value, with no record", () => {
    const { plugin, calls } = watcher("watch");
    const store = make(contact(), [starts("start", { phone: "5", code: "x" }), plugin]);
    expect(store.getSnapshot([]).value).toEqual({ phone: "5", code: "x" });
    expect(store.getServerSnapshot(["phone"]).value).toBe("5");
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(store.changes()).toEqual([]);
    expect(store.getSnapshot(["phone"]).edited).toBe(false);
    flushPlugins(store);
    expect(calls).toEqual([]);
    store.root.at("phone").setValue("6");
    store.reset();
    expect(store.getSnapshot([]).value).toEqual({ phone: "5", code: "x" });
  });

  it("gives each plugin the value the one before returned, so the last one wins", () => {
    const seen: unknown[] = [];
    const first = { phone: "1", code: "" };
    const store = make(contact(), [
      starts("a", first),
      starts("b", { phone: "2", code: "" }, seen),
      starts("c", undefined, seen),
    ]);
    expect(seen).toEqual([first, { phone: "2", code: "" }]);
    expect(store.getSnapshot(["phone"]).value).toBe("2");
  });
});

describe("onActive", () => {
  it("runs at the first listener and cleans up after the last", () => {
    const events: string[] = [];
    const plugin = definePlugin({
      name: "active",
      setup: () => ({
        onActive() {
          events.push("on");
          return () => void events.push("off");
        },
      }),
    });
    const store = make(contact(), [plugin]);
    expect(events).toEqual([]);
    const field = store.subscribe(["phone"], () => {});
    const form = store.subscribeForm(() => {});
    expect(events).toEqual(["on"]);
    field();
    field();
    expect(events).toEqual(["on"]);
    form();
    expect(events).toEqual(["on", "off"]);
    store.subscribeForm(() => {});
    expect(events).toEqual(["on", "off", "on"]);
  });

  it("runs writes it makes before the subscribe returns, and reports throws", () => {
    const errors: string[] = [];
    const writer = definePlugin({
      name: "writer",
      setup: (ctx) => ({
        onActive() {
          ctx.write(() => ctx.store.root.at("code").setValue("on"));
          return () => {
            throw new Error("cleanup");
          };
        },
      }),
    });
    const thrower = definePlugin({
      name: "thrower",
      setup: () => ({
        onActive() {
          throw new Error("start");
        },
      }),
    });
    const store = make(contact(), [thrower, writer], (error) => void errors.push(String(error)));
    const stop = store.subscribeForm(() => {});
    expect(store.root.peek().value.code).toBe("on");
    stop();
    expect(errors).toEqual(["Error: start", "Error: cleanup"]);
  });

  it("runs writes its cleanup makes before the unsubscribe returns", () => {
    const { plugin: watch, calls } = watcher("watch", "sync");
    const writer = definePlugin({
      name: "writer",
      setup: (ctx) => ({
        onActive: () => () => ctx.write(() => ctx.store.root.at("code").setValue("off")),
      }),
    });
    const store = make(contact(), [watch, writer]);
    const stop = store.subscribeForm(() => {});
    stop();
    expect(store.root.peek().value.code).toBe("off");
    expect(calls).toEqual([[{ type: "value", path: ["code"], before: "", after: "off", cause: { plugin: "writer" } }]]);
  });
});
