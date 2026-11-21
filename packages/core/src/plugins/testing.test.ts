import { describe, expect, it } from "vitest";
import { definePlugin, refuse } from "../plugins.js";
import { testStore } from "./testing.js";
import { arrays } from "./arrays.js";
import { fieldValidators } from "../index.js";

const contact = () => ({ phone: "", code: "" });

// The plugin on the Writing a plugin docs page: trims the ends of every string written at `fields`.
const trim = (...fields: string[]) =>
  definePlugin({
    name: "trim",
    setup: () => ({
      beforeWrite: (write) => (typeof write.value === "string" && fields.includes(write.path.join(".")) ? write.value.trim() : write.value),
    }),
  })();

describe("testStore", () => {
  it("records each timing's deliveries, and delivers the waiting ones on flush", async () => {
    const { store, records, flush } = testStore({ defaultValues: contact(), plugins: [arrays(), ] });
    store.root.at("phone").setValue("1");
    const write = { type: "value", path: ["phone"], before: "", after: "1", cause: "user" };
    expect(records).toEqual({ sync: [write], deferred: [], idle: [] });
    await Promise.resolve();
    expect(records).toEqual({ sync: [write], deferred: [write], idle: [] });
    flush();
    expect(records).toEqual({ sync: [write], deferred: [write], idle: [write] });
    // A list can be emptied between steps.
    records.sync.length = 0;
    store.root.at("code").setValue("2");
    expect(records.sync).toEqual([{ type: "value", path: ["code"], before: "", after: "2", cause: "user" }]);
  });

  it("records a plugin's own writes with it as the cause", () => {
    const copy = definePlugin({
      name: "copy",
      setup: (ctx) => ({
        onWrite(list) {
          if (list.some((record) => record.path[0] === "phone")) ctx.write(() => ctx.store.root.at("code").setValue("copied"));
        },
      }),
    })();
    const { store, records } = testStore({ defaultValues: contact(), plugins: [arrays(), copy] });
    store.root.at("phone").setValue("1");
    expect(records.sync.map((record) => [record.path, record.cause])).toEqual([
      [["phone"], "user"],
      [["code"], { plugin: "copy" }],
    ]);
  });

  it("collects what hooks throw, and the store carries on", () => {
    const broken = definePlugin({
      name: "broken",
      setup: () => ({
        onWrite() {
          throw new Error("after");
        },
      }),
    })();
    const { store, errors } = testStore({ defaultValues: contact(), plugins: [arrays(), broken] });
    store.root.at("phone").setValue("1");
    expect(store.root.at("phone").peek().value).toBe("1");
    expect(errors).toEqual([{ plugin: "broken", error: new Error("after") }]);
  });

  it("runs onActive on listen and its cleanup on the stop listen returns", () => {
    const events: string[] = [];
    const active = definePlugin({
      name: "active",
      setup: () => ({
        onActive() {
          events.push("on");
          return () => void events.push("off");
        },
      }),
    })();
    const { listen } = testStore({ defaultValues: contact(), plugins: [arrays(), active] });
    expect(events).toEqual([]);
    const stop = listen();
    expect(events).toEqual(["on"]);
    stop();
    expect(events).toEqual(["on", "off"]);
  });

  it("reads the server snapshot of every field, setup's writes and meta included", () => {
    const fill = definePlugin({
      name: "fill",
      initialFormMeta: "",
      requires: () => [arrays],
      setup: (ctx) => {
        ctx.write(() => ctx.store.root.at("rows").push({ t: "b" }, { edited: false }));
        ctx.setFormMeta("filled");
        return {};
      },
    })();
    const config = { defaultValues: { name: "", rows: [{ t: "a" }] }, plugins: [arrays(), fill] };
    const { store, server } = testStore(config);
    const before = server();
    expect(Object.keys(before.fields)).toEqual(["", "name", "rows", "rows.0", "rows.0.t", "rows.1", "rows.1.t"]);
    expect(before.fields["rows.1.t"]?.value).toBe("b");
    expect(before.form.meta).toEqual({ fill: "filled" });
    // Writes after the store is made don't reach it.
    store.root.at("name").setValue("x");
    expect(server()).toEqual(before);
    // Setup gives the same result on every store.
    expect(testStore(config).server()).toEqual(before);
  });

  it("drives onReset, beforeSubmit and onSubmitted through the store", async () => {
    const events: unknown[] = [];
    const watch = definePlugin({
      name: "watch",
      setup: () => ({
        onReset: (path) => void events.push(["reset", path]),
        beforeSubmit: () => void events.push("submit"),
        onSubmitted: (submission) => void events.push(submission.status),
      }),
    })();
    const { store, errors } = testStore({
      defaultValues: contact(),
      plugins: [arrays(), watch],
      validate: { fields: fieldValidators({ phone: (value) => (value === "" ? { message: "Required" } : undefined) }) },
      onSubmit: (value) => value.phone,
    });
    expect(await store.submit()).toEqual({ status: "invalid" });
    store.root.at("phone").setValue("1");
    expect(await store.submit()).toEqual({ status: "succeeded", result: "1" });
    store.root.at("phone").reset();
    expect(events).toEqual(["submit", "invalid", "submit", "succeeded", ["reset", ["phone"]]]);
    expect(errors).toEqual([]);
  });

  it("runs the example on the Writing a plugin page", () => {
    const { store, records, errors } = testStore({ defaultValues: { name: "", note: "" }, plugins: [arrays(), trim("name")] });
    store.root.at("name").setValue("  Ada ");
    store.root.at("note").setValue(" hi ");
    expect(store.root.peek().value).toEqual({ name: "Ada", note: " hi " });
    expect(records.sync[0]).toMatchObject({ path: ["name"], after: "Ada", cause: "user" });
    expect(errors).toEqual([]);
  });

  it("types store.plugins from the plugin list", async () => {
    const lock = definePlugin({ name: "lock", setup: () => ({ beforeSubmit: () => refuse, api: { locked: true } }) })();
    const { store } = testStore({ defaultValues: contact(), plugins: [arrays(), lock] });
    const locked: boolean = store.plugins.lock.locked;
    expect(locked).toBe(true);
    expect(await store.submit()).toEqual({ status: "invalid" });
  });
});
