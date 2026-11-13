import { describe, expect, it } from "vitest";
import { history } from "./history.js";
import { testStore } from "./testing.js";

const contact = () => ({ phone: "", code: "" });

describe("history", () => {
  it("undoes and redoes user edits a task at a time", () => {
    const undoHistory = history();
    const { store, flush, errors } = testStore({ defaultValues: { name: "", tags: ["a", "b"] }, plugins: [undoHistory] });
    const api = store.plugins.history;
    store.root.at("name").setValue("A");
    flush();
    store.root.at("name").setValue("Ab");
    store.root.at("tags").remove(0);
    // Not delivered yet: undo flushes first, so the edit and the remove are one step.
    expect(api.undo()).toBe(true);
    expect(store.root.peek().value).toEqual({ name: "A", tags: ["a", "b"] });
    expect(api.undo()).toBe(true);
    expect(store.root.peek().value).toEqual({ name: "", tags: ["a", "b"] });
    expect(undoHistory.formMeta(store.getFormSnapshot())?.canUndo).toBe(false);
    expect(api.redo()).toBe(true);
    expect(api.redo()).toBe(true);
    expect(store.root.peek().value).toEqual({ name: "Ab", tags: ["b"] });
    // Its own writes never became steps.
    flush();
    expect(undoHistory.formMeta(store.getFormSnapshot())?.canRedo).toBe(false);
    expect(api.undo()).toBe(true);
    expect(errors).toEqual([]);
  });

  it("replays array steps as array commands, so items keep their keys and state", () => {
    const { store, flush, errors } = testStore({ defaultValues: { rows: [{ title: "a" }, { title: "b" }, { title: "c" }] }, plugins: [history()] });
    const api = store.plugins.history;
    const rows = store.root.at("rows");
    const keys = rows.peek().keys;
    const [, b] = keys;
    if (b === undefined) throw new Error("three rows");
    rows.item(b).at("title").setTouched();

    rows.move(1, 0);
    flush();
    expect(api.undo()).toBe(true);
    expect(rows.peek().keys).toEqual(keys);
    expect(rows.item(b).at("title").peek()).toMatchObject({ value: "b", touched: true });

    rows.remove(2);
    flush();
    expect(api.undo()).toBe(true);
    expect(rows.peek().value).toEqual([{ title: "a" }, { title: "b" }, { title: "c" }]);
    // The items that stayed keep their keys and state. The one that came back is a new item.
    expect(rows.peek().keys.slice(0, 2)).toEqual(keys.slice(0, 2));
    expect(rows.peek().keys[2]).not.toBe(keys[2]);
    expect(rows.item(b).at("title").peek().touched).toBe(true);
    expect(errors).toEqual([]);
  });

  it("forgets everything on reset", () => {
    const undoHistory = history();
    const { store, flush, errors } = testStore({ defaultValues: contact(), plugins: [undoHistory] });
    store.root.at("phone").setValue("1");
    flush();
    store.reset();
    flush();
    expect(undoHistory.formMeta(store.getFormSnapshot())?.canUndo).toBe(false);
    expect(store.plugins.history.undo()).toBe(false);
    expect(errors).toEqual([]);
  });

  it("keeps canUndo and canRedo in its form meta, written only when one changes", async () => {
    const undoHistory = history(2);
    const { store, errors } = testStore({ defaultValues: contact(), plugins: [undoHistory] });
    const flags = () => undoHistory.formMeta(store.getFormSnapshot());
    const writes: unknown[] = [];
    store.subscribeForm(() => {
      const meta = flags();
      if (meta !== writes[writes.length - 1]) writes.push(meta);
    });
    expect(flags()).toBeUndefined();

    // The flag trails the edit by a microtask, when the step is recorded.
    store.root.at("phone").setValue("1");
    expect(flags()).toBeUndefined();
    await Promise.resolve();
    expect(flags()).toEqual({ canUndo: true, canRedo: false });
    // A second step changes no flag, so nothing is written.
    store.root.at("phone").setValue("12");
    await Promise.resolve();
    store.root.at("phone").setValue("123");
    await Promise.resolve();
    expect(writes).toHaveLength(1);

    // The limit keeps two steps, so the third undo has nothing.
    expect(store.plugins.history.undo()).toBe(true);
    expect(flags()).toEqual({ canUndo: true, canRedo: true });
    expect(store.plugins.history.undo()).toBe(true);
    expect(flags()).toEqual({ canUndo: false, canRedo: true });
    expect(store.plugins.history.undo()).toBe(false);
    expect(store.root.peek().value.phone).toBe("1");

    expect(store.plugins.history.redo()).toBe(true);
    expect(flags()).toEqual({ canUndo: true, canRedo: true });
    expect(store.plugins.history.redo()).toBe(true);
    expect(flags()).toEqual({ canUndo: true, canRedo: false });

    store.reset();
    expect(flags()).toEqual({ canUndo: false, canRedo: false });
    expect(writes).toHaveLength(6);
    expect(errors).toEqual([]);
  });

  it("sets its flags in the same notification as the undo", () => {
    const undoHistory = history();
    const { store, flush, errors } = testStore({ defaultValues: contact(), plugins: [undoHistory] });
    store.root.at("phone").setValue("1");
    flush();
    const seen: unknown[] = [];
    store.subscribeForm(() => seen.push([store.root.peek().value.phone, undoHistory.formMeta(store.getFormSnapshot())]));
    store.plugins.history.undo();
    expect(seen).toEqual([["", { canUndo: false, canRedo: true }]]);
    expect(errors).toEqual([]);
  });

  it("records only user edits, as the deferred records show", () => {
    const { store, records, flush, errors } = testStore({ defaultValues: contact(), plugins: [history()] });
    store.root.at("phone").setValue("1");
    expect(records.deferred).toEqual([]);
    flush();
    store.plugins.history.undo();
    flush();
    expect(records.deferred.map((record) => record.cause)).toEqual(["user", { plugin: "history" }]);
    expect(store.plugins.history.undo()).toBe(false);
    expect(errors).toEqual([]);
  });
});
