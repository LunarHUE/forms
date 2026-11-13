import { afterEach, describe, expect, it, vi } from "vitest";
import { type AnyHookPlugin, createFormsCore, type PluginErrorHandler, type Write, type WriteRecord } from "../index.js";
import { definePlugin, flushPlugins, refuse } from "../plugins.js";
import { rebase } from "../rebase.js";
import { validation } from "../validation.js";
import { history } from "./fixtures/history.js";
import { digits, mask, upper } from "./fixtures/mask.js";
import { persist } from "./fixtures/persist.js";
import { rules } from "./fixtures/rules.js";

interface Contact {
  phone: string;
  code: string;
}

const contact = (): Contact => ({ phone: "", code: "" });

const rethrow: PluginErrorHandler = (error) => {
  throw error;
};

/** A store with `plugins` on its definition. Plugin errors throw unless `onPluginError` says otherwise. */
const make = <V, const D extends readonly AnyHookPlugin[]>(defaultValues: V, plugins: D, onPluginError: PluginErrorHandler = rethrow) =>
  createFormsCore({ onPluginError }).define<V, never, void, undefined, unknown, D>({ defaultValues, plugins }).createStore();

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
    setup: (ctx) => {
      ctx.setMeta(["phone"], value);
      return {};
    },
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
    createFormsCore({ plugins: [named("shared")] })
      .define({ defaultValues: contact(), plugins: [named("own")] })
      .createStore();
    expect(order).toEqual(["shared", "own"]);
  });

  it("puts each plugin's api on store.plugins under its name", () => {
    const counter = definePlugin({ name: "counter", setup: () => ({ api: { count: 3 } }) });
    const silent = definePlugin({ name: "silent", setup: () => ({}) });
    expect(make(contact(), [counter, silent]).plugins).toEqual({ counter: { count: 3 } });
    expect(make(contact(), []).plugins).toEqual({});
    expect(createFormsCore().define({ defaultValues: contact() }).createStore().plugins).toEqual({});
  });

  it("throws at store creation on two plugins with one name", () => {
    const one = definePlugin({ name: "one", setup: () => ({}) });
    expect(() => make(contact(), [one, one])).toThrow('Two plugins are named "one".');
  });

  it("throws at store creation on a shared and a definition plugin with one name", () => {
    const one = definePlugin({ name: "one", setup: () => ({}) });
    const form = createFormsCore({ plugins: [one] }).define({ defaultValues: contact(), plugins: [one] });
    expect(() => form.createStore()).toThrow('Two plugins are named "one".');
  });

  it("puts the APIs of both lists on store.plugins", () => {
    const shared = definePlugin({ name: "shared", setup: () => ({ api: 1 }) });
    const own = definePlugin({ name: "own", setup: () => ({ api: 2 }) });
    const store = createFormsCore({ plugins: [shared] }).define({ defaultValues: contact(), plugins: [own] }).createStore();
    expect(store.plugins).toEqual({ shared: 1, own: 2 });
  });

  it("throws at store creation on an `after` cycle", () => {
    const a = definePlugin({ name: "a", after: ["b"], setup: () => ({}) });
    const b = definePlugin({ name: "b", after: ["a"], setup: () => ({}) });
    expect(() => make(contact(), [a, b])).toThrow(/part of an `after` cycle/);
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
  it("stores the value a plugin returns", () => {
    const store = make(contact(), [mask({ phone: digits })]);
    store.root.at("phone").setValue("(555) 01-23");
    expect(store.root.at("phone").peek().value).toBe("5550123");
  });

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
    const late = make(contact(), [mask({ code: upper }, { after: ["tag"] }), tag]);
    late.root.at("code").setValue("ab");
    expect(late.root.at("code").peek().value).toBe("X-AB");
    expect(seen).toEqual([{ input: "ab", value: "ab" }]);

    seen.length = 0;
    const early = make(contact(), [mask({ code: upper }), tag]);
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

  it("doesn't see the items push and insert add", () => {
    const before = vi.fn<(write: Write) => unknown>((write) => write.value);
    const store = make({ tags: ["a"] }, [definePlugin({ name: "look", setup: () => ({ beforeWrite: before }) })]);
    store.root.at("tags").push("b");
    store.root.at("tags").insert(0, "c");
    expect(store.root.at("tags").peek().value).toEqual(["c", "a", "b"]);
    expect(before).not.toHaveBeenCalled();
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
    const store = make(contact(), [plugin]);
    store.root.at("phone").setValue("1");
    store.reset();
    rebase(store.root, { phone: "2", code: "" }, () => "take");
    expect(calls.map((records) => records.map((record) => record.cause))).toEqual([["user"], ["reset"], ["rebase"]]);
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
    const store = createFormsCore().define({ defaultValues: contact(), plugins: [broken] }).createStore();
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
    expect(errors.map(String)).toEqual([
      "Error: A plugin wrote to the store from inside a hook. Write through `ctx.write`.",
      "Error: A plugin wrote to the store from inside a hook. Write through `ctx.write`.",
    ]);
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
    const meta = definePlugin({ name: "m", setup: (ctx) => ({ api: { set: (value: number) => ctx.setMeta(["phone"], value) } }) });
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

describe("reset and submit", () => {
  it("calls onReset inside the reset's batch, after the values went back", () => {
    const seen: unknown[] = [];
    const watch = definePlugin({
      name: "watch",
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
    const store = createFormsCore()
      .define({ defaultValues: contact(), plugins: [upload], onSubmit: () => void order.push("onSubmit") })
      .createStore();
    await store.submit();
    expect(order).toEqual(["upload done", "onSubmit", "succeeded"]);
  });

  it("tells onSubmitted about an invalid submit too", async () => {
    const ended: string[] = [];
    const plugin = definePlugin({ name: "end", setup: () => ({ onSubmitted: (submission) => void ended.push(submission.status) }) });
    const store = createFormsCore({ plugins: [validation()] })
      .define({
        defaultValues: contact(),
        plugins: [plugin],
        validate: { fields: { phone: (value) => (value === "" ? { message: "Required" } : undefined) } },
      })
      .createStore();
    await store.submit();
    expect(ended).toEqual(["invalid"]);
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
});

describe("server rendering", () => {
  it("keeps plugin work off the server snapshots and leaves no timer open", async () => {
    vi.useFakeTimers();
    interface Order {
      sameAsBilling: boolean;
      shipping: { street: string };
    }
    const order: Order = { sameAsBilling: true, shipping: { street: "" } };
    const store = make(order, [
      rules<Order>({ shipping: (value) => ({ disabled: value.sameAsBilling, hidden: value.sameAsBilling }) }),
      history(),
      persist("order", undefined),
      definePlugin({
        name: "form",
        setup: (ctx) => {
          ctx.setFormMeta(true);
          return {};
        },
      }),
    ]);
    // Setup ran: the current snapshots have the plugins' work.
    expect(store.getSnapshot(["shipping"])).toMatchObject({ disabled: true, meta: { rules: { hidden: true } } });
    expect(store.getFormSnapshot().meta).toEqual({ form: true });
    // The server snapshots are the definition's alone.
    const server = store.getServerSnapshot(["shipping"]);
    expect(server.disabled).toBe(false);
    expect("meta" in server).toBe(false);
    expect("meta" in store.getServerFormSnapshot()).toBe(false);
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("fixtures", () => {
  interface Order {
    sameAsBilling: boolean;
    shipping: { street: string };
  }

  it("rules derives disabled and hidden from the value before listeners run", () => {
    const ruleSet = rules<Order>({ shipping: (value) => ({ disabled: value.sameAsBilling, hidden: value.sameAsBilling }) });
    const order: Order = { sameAsBilling: true, shipping: { street: "" } };
    const store = make(order, [ruleSet]);
    const seen: unknown[] = [];
    store.subscribe(["shipping"], () => {
      const snapshot = store.getSnapshot(["shipping"]);
      seen.push({ disabled: snapshot.disabled, hidden: ruleSet.meta(snapshot)?.hidden });
    });
    store.root.at("sameAsBilling").setValue(false);
    expect(seen).toEqual([{ disabled: false, hidden: false }]);
  });

  it("history undoes and redoes user edits a task at a time", async () => {
    const store = make({ name: "", tags: ["a", "b"] }, [history()]);
    const api = store.plugins.history;
    store.root.at("name").setValue("A");
    await Promise.resolve();
    store.root.at("name").setValue("Ab");
    store.root.at("tags").remove(0);
    // Not delivered yet: undo flushes first, so the edit and the remove are one step.
    expect(api.undo()).toBe(true);
    expect(store.root.peek().value).toEqual({ name: "A", tags: ["a", "b"] });
    expect(api.undo()).toBe(true);
    expect(store.root.peek().value).toEqual({ name: "", tags: ["a", "b"] });
    expect(api.canUndo).toBe(false);
    expect(api.redo()).toBe(true);
    expect(api.redo()).toBe(true);
    expect(store.root.peek().value).toEqual({ name: "Ab", tags: ["b"] });
    // Its own writes never became steps.
    await Promise.resolve();
    expect(api.canRedo).toBe(false);
    expect(api.undo()).toBe(true);
  });

  it("history replays array steps as array commands, so items keep their keys and state", async () => {
    const store = make({ rows: [{ title: "a" }, { title: "b" }, { title: "c" }] }, [history()]);
    const api = store.plugins.history;
    const rows = store.root.at("rows");
    const keys = rows.peek().keys;
    const [, b] = keys;
    if (b === undefined) throw new Error("three rows");
    rows.item(b).at("title").setTouched();

    rows.move(1, 0);
    await Promise.resolve();
    expect(api.undo()).toBe(true);
    expect(rows.peek().keys).toEqual(keys);
    expect(rows.item(b).at("title").peek()).toMatchObject({ value: "b", touched: true });

    rows.remove(2);
    await Promise.resolve();
    expect(api.undo()).toBe(true);
    expect(rows.peek().value).toEqual([{ title: "a" }, { title: "b" }, { title: "c" }]);
    // The items that stayed keep their keys and state. The one that came back is a new item.
    expect(rows.peek().keys.slice(0, 2)).toEqual(keys.slice(0, 2));
    expect(rows.peek().keys[2]).not.toBe(keys[2]);
    expect(rows.item(b).at("title").peek().touched).toBe(true);
  });

  it("history forgets everything on reset", async () => {
    const store = make(contact(), [history()]);
    store.root.at("phone").setValue("1");
    await Promise.resolve();
    store.reset();
    await Promise.resolve();
    expect(store.plugins.history.canUndo).toBe(false);
  });

  it("persist saves on idle and restores at creation without marking anything edited", () => {
    vi.useFakeTimers();
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    };
    const first = make(contact(), [persist("contact", storage)]);
    first.root.at("phone").setValue("123");
    expect(saved.size).toBe(0);
    vi.runAllTimers();
    expect(saved.get("contact")).toBe('{"phone":"123","code":""}');
    const second = make(contact(), [persist("contact", storage)]);
    expect(second.root.peek()).toMatchObject({ value: { phone: "123", code: "" }, edited: false });
  });
});
