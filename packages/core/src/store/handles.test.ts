import { describe, expect, it, vi } from "vitest";
import type { FormError } from "../errors.js";
import type { AnyFieldHandle } from "../handle.js";
import type { Path } from "../path.js";
import type { FormStore } from "../store.js";
import { createFormInternals, type FormStoreOptions } from "./form-store.js";

type Options = Omit<FormStoreOptions<unknown>, "id" | "initial">;

const make = (initial: unknown, options: Options = {}) => {
  const parts = createFormInternals<unknown>({ id: "f", initial, ...options });
  const written = vi.spyOn(parts.validation, "written");
  const blurred = vi.spyOn(parts.validation, "blurred");
  return { ...parts, root: parts.store.root, written, blurred };
};

const err = (message: string): FormError => ({ message });

/** Looks a handle up by stable path and fails the test when there is none. */
function field(store: FormStore<unknown>, path: Path): AnyFieldHandle {
  const handle = store.fieldAt(path);
  if (!handle) throw new Error(`no field at ${path.join(".")}`);
  return handle;
}

/** Counts listener calls per path. `"form"` counts form listener calls. */
function count(store: FormStore<unknown>, paths: (Path | "form")[]) {
  const runs = paths.map(() => 0);
  for (const [i, path] of paths.entries()) {
    const listener = () => void (runs[i] = (runs[i] ?? 0) + 1);
    if (path === "form") store.subscribeForm(listener);
    else store.subscribe(path, listener);
  }
  return runs;
}

describe("handle identity", () => {
  it("returns the same handle for the same stable path", () => {
    const { store, root } = make({ user: { name: "a" }, rows: [{ t: 1 }] });
    expect(store.root).toBe(root);
    expect(root.at("user")).toBe(root.at("user"));
    expect(root.at("user").at("name")).toBe(root.at("user").at("name"));
    expect(root.at("rows").item("k0")).toBe(root.at("rows").item("k0"));
    expect(store.fieldAt([])).toBe(root);
    expect(store.fieldAt(["user", "name"])).toBe(root.at("user").at("name"));
    expect(store.fieldAt(["rows", "k0", "t"])).toBe(root.at("rows").item("k0").at("t"));
    expect(store.fieldAt(["rows", "k0"])).toBe(root.at("rows").item("k0"));
  });

  it("holds its id, a frozen stable path, its store and an item's key", () => {
    const { store, root } = make({ rows: [{ t: 1 }] });
    const row = root.at("rows").item("k0");
    expect(row.id).toBe("f--rows--k0");
    expect(root.id).toBe("f");
    expect(row.path).toEqual(["rows", "k0"]);
    expect(row.path).toBe(row.path);
    expect(Object.isFrozen(row.path)).toBe(true);
    expect(row.store).toBe(store);
    expect(row.key).toBe("k0");
    expect("key" in root.at("rows")).toBe(false);
    expect(root.at(1).path).toEqual(["1"]);
    expect(root.at(1)).toBe(root.at("1"));
  });

  it("is frozen in development", () => {
    const { root } = make({ a: 1 });
    expect(Object.isFrozen(root)).toBe(true);
    expect(Object.isFrozen(root.at("a"))).toBe(true);
  });

  it("is made without touching the store", () => {
    const { core, store, root } = make({ rows: [{ t: 1 }], a: { b: 1 } });
    root.at("a").at("b");
    root.at("rows").item("k3").at("t");
    root.at("nope").at("deeper");
    expect(store.fieldAt(["rows", "k0", "t"])).toBeDefined();
    expect(core.stats()).toEqual({ nodes: 0, subscribed: 0 });
  });

  it("peeks at the store's snapshot", () => {
    const { store, root } = make({ a: { b: 1 } });
    const b = root.at("a").at("b");
    expect(b.peek()).toBe(store.getSnapshot(["a", "b"]));
    b.setValue(2);
    expect(b.peek()).toBe(store.getSnapshot(["a", "b"]));
    expect(b.peek().value).toBe(2);
  });
});

const fn = () => 1;
const check = () => undefined;

describe("user edits", () => {
  it("write the value, mark edited up the tree, clear user errors at and below, and tell validation", () => {
    const { store, root, written } = make({ a: { b: { c: 1 } }, d: 1 });
    const b = root.at("a").at("b");
    b.at("c").setErrors(err("below"));
    b.setErrors(err("here"));
    root.at("a").setErrors(err("above"));
    root.at("d").setErrors(err("sibling"));
    b.setValue({ c: 2 });
    expect(store.getSnapshot(["a", "b", "c"]).value).toBe(2);
    expect(b.peek().edited).toBe(true);
    expect(root.at("a").peek().edited).toBe(true);
    expect(root.peek().edited).toBe(true);
    expect(b.at("c").peek().edited).toBe(false);
    expect(b.peek().errors).toEqual([]);
    expect(b.at("c").peek().errors).toEqual([]);
    expect(root.at("a").peek().errors).toEqual([err("above")]);
    expect(root.at("d").peek().errors).toEqual([err("sibling")]);
    expect(written).toHaveBeenCalledTimes(1);
    expect(written).toHaveBeenCalledWith(["a", "b"]);
  });

  it("only write the value with edited: false", () => {
    const { root, written } = make({ a: 1 });
    root.at("a").setErrors(err("u"));
    root.at("a").setValue(2, { edited: false });
    expect(root.at("a").peek()).toMatchObject({ value: 2, edited: false, errors: [err("u")] });
    expect(written).not.toHaveBeenCalled();
  });

  it("do nothing when the value doesn't change", () => {
    const { store, root, written } = make({ a: { b: 1 } });
    root.at("a").at("b").setErrors(err("u"));
    const runs = count(store, [["a", "b"], ["a"], [], "form"]);
    root.at("a").at("b").setValue(1);
    root.at("a").setValue({ b: 1 });
    root.at("a").at("b").setValue((previous: unknown) => previous);
    expect(root.at("a").at("b").peek()).toMatchObject({ edited: false, errors: [err("u")] });
    expect(written).not.toHaveBeenCalled();
    expect(runs).toEqual([0, 0, 0, 0]);
  });

  it("wake each listener once when value, edited and errors change together", () => {
    const { store, root } = make({ a: { b: 1 } });
    root.at("a").at("b").setErrors(err("u"));
    const runs = count(store, [["a", "b"], ["a"], [], "form"]);
    root.at("a").at("b").setValue(2);
    // The first edit also makes the form dirty. The second leaves it dirty, so the form listener stays put.
    expect(runs).toEqual([1, 1, 1, 1]);
    root.at("a").at("b").setValue(3);
    expect(runs).toEqual([2, 2, 2, 1]);
  });
});

describe("setValue", () => {
  it("merges an object one level deep", () => {
    const { root } = make({ user: { name: "a", tags: ["x"], address: { city: "c" } } });
    const tags = root.at("user").at("tags").peek().value;
    root.at("user").setValue({ name: "b", address: { street: "s" } });
    expect(root.at("user").peek().value).toEqual({ name: "b", tags: ["x"], address: { street: "s" } });
    expect(root.at("user").at("tags").peek().value).toBe(tags);
  });

  it("merges into a missing object from an empty one", () => {
    const { root } = make({ user: undefined });
    root.at("user").setValue({ name: "a" });
    expect(root.at("user").peek().value).toEqual({ name: "a" });
  });

  it("replaces with replace: true", () => {
    const { root } = make({ user: { name: "a", age: 1 } });
    root.at("user").setValue({ name: "b" }, { replace: true });
    expect(root.at("user").peek().value).toEqual({ name: "b" });
    root.at("user").setValue(undefined, { replace: true });
    expect(root.at("user").peek().value).toBeUndefined();
  });

  it("replaces when the value or the argument is not a plain object", () => {
    const { root } = make({ a: "text", b: { x: 1 }, list: [1] });
    root.at("a").setValue({ y: 1 });
    expect(root.at("a").peek().value).toEqual({ y: 1 });
    const date = new Date(0);
    root.at("b").setValue(date);
    expect(root.at("b").peek().value).toBe(date);
    root.at("list").setValue([2, 3]);
    expect(root.at("list").peek().value).toEqual([2, 3]);
  });

  it("calls an updater with the current value", () => {
    const { root } = make({ n: 1, user: { name: "a", age: 1 } });
    root.at("n").setValue((previous: unknown) => Number(previous) + 1);
    expect(root.at("n").peek().value).toBe(2);
    root.at("user").setValue(() => ({ age: 2 }));
    expect(root.at("user").peek().value).toEqual({ name: "a", age: 2 });
    root.at("user").setValue(() => ({ age: 3 }), { replace: true });
    expect(root.at("user").peek().value).toEqual({ age: 3 });
  });

  it("writes a function value through an updater", () => {
    const { root } = make({ fn: undefined });
    root.at("fn").setValue(() => fn);
    expect(root.at("fn").peek().value).toBe(fn);
  });
});

describe("array commands", () => {
  it("push, insert, remove and move through the handle, each as a user edit", () => {
    const { root, written } = make({ list: ["a"] });
    const list = root.at("list");
    list.push("b");
    list.insert(0, "z");
    expect(list.peek().value).toEqual(["z", "a", "b"]);
    list.move(0, 2);
    expect(list.peek().value).toEqual(["a", "b", "z"]);
    list.remove(1);
    expect(list.peek().value).toEqual(["a", "z"]);
    expect(list.peek().keys).toEqual(["k0", "k2"]);
    expect(list.peek().edited).toBe(true);
    expect(written).toHaveBeenCalledTimes(4);
    for (const call of written.mock.calls) expect(call).toEqual([["list"]]);
  });

  it("uses itemValue when push or insert gets no item", () => {
    const itemValue = vi.fn<(path: Path) => unknown>(() => ({ title: "" }));
    const { root } = make({ rows: [] }, { itemValue });
    root.at("rows").push();
    root.at("rows").insert(0, undefined, { edited: false });
    expect(itemValue).toHaveBeenCalledTimes(2);
    expect(itemValue).toHaveBeenCalledWith(["rows"]);
    expect(root.at("rows").peek().value).toEqual([{ title: "" }, { title: "" }]);
  });

  it("adds undefined for a bare push without itemValue", () => {
    const { root } = make({ list: [] });
    root.at("list").push();
    expect(root.at("list").peek().value).toEqual([undefined]);
  });

  it("does nothing for an out-of-range remove or a move to the same place", () => {
    const { root, written } = make({ list: ["a"] });
    root.at("list").remove(3);
    root.at("list").move(0, 0);
    expect(root.at("list").peek().edited).toBe(false);
    expect(written).not.toHaveBeenCalled();
  });

  it("keeps an item's handle on its item through move and insert", () => {
    const { root } = make({ rows: [{ t: "a" }, { t: "b" }] });
    const rows = root.at("rows");
    const b = rows.item("k1");
    expect(b.peek().name).toBe("rows.1");
    rows.move(1, 0);
    expect(rows.item("k1")).toBe(b);
    expect(b.peek().name).toBe("rows.0");
    rows.insert(0, { t: "new" });
    expect(rows.item("k1")).toBe(b);
    expect(b.peek().name).toBe("rows.1");
    expect(b.at("t").peek().value).toBe("b");
  });

  it("leaves a removed item's handle inert, with its last snapshot", async () => {
    const { core, store, root, written, blurred } = make({ rows: [{ t: "a" }, { t: "b" }] });
    const a = root.at("rows").item("k0");
    const last = a.peek();
    const lastTitle = a.at("t").peek();
    root.at("rows").remove(0);
    written.mockClear();
    const before = core.getSnapshot([]);
    a.setValue({ t: "x" });
    const updater = vi.fn<(previous: unknown) => unknown>(() => ({ t: "x" }));
    a.setValue(updater);
    expect(updater).not.toHaveBeenCalled();
    a.at("t").setValue("x");
    a.handleBlur();
    a.setErrors(err("u"));
    a.setDisabled(true);
    a.setReadOnly(true);
    a.reset();
    a.push("x");
    expect(a.registerValidator(() => undefined)).toBeTypeOf("function");
    await expect(a.validate()).resolves.toBe(true);
    expect(a.peek()).toBe(last);
    expect(a.at("t").peek()).toBe(lastTitle);
    expect(core.getSnapshot([])).toBe(before);
    expect(written).not.toHaveBeenCalled();
    expect(blurred).not.toHaveBeenCalled();
    expect(store.fieldAt(["rows", "k0"])).toBe(a);
  });

  it("ignores commands on a path through a leaf", async () => {
    const { root } = make({ a: 1 });
    const below = root.at("a").at("b");
    below.setValue(2);
    below.handleBlur();
    await expect(below.validate()).resolves.toBe(true);
    expect(root.peek().value).toEqual({ a: 1 });
  });
});

describe("field state commands", () => {
  it("handleBlur marks touched, then tells validation, waking listeners once", () => {
    const { store, root, blurred } = make({ a: 1 });
    const runs = count(store, [["a"]]);
    root.at("a").handleBlur();
    expect(root.at("a").peek().touched).toBe(true);
    expect(blurred).toHaveBeenCalledTimes(1);
    expect(blurred).toHaveBeenCalledWith(["a"]);
    expect(runs).toEqual([1]);
  });

  it("setErrors takes one error or a list and replaces the field's user errors", () => {
    const { root } = make({ a: 1 });
    root.at("a").setErrors(err("one"));
    expect(root.at("a").peek().errors).toEqual([err("one")]);
    root.at("a").setErrors([err("x"), err("y")]);
    expect(root.at("a").peek().errors).toEqual([err("x"), err("y")]);
    root.at("a").setErrors([]);
    expect(root.at("a").peek().errors).toEqual([]);
  });

  it("setDisabled and setReadOnly reach every handle below", () => {
    const { root } = make({ a: { b: { c: 1 } }, d: 1 });
    root.at("a").setDisabled(true);
    root.at("a").at("b").setReadOnly(true);
    expect(root.at("a").at("b").at("c").peek()).toMatchObject({ disabled: true, readOnly: true });
    expect(root.at("a").peek()).toMatchObject({ disabled: true, readOnly: false });
    expect(root.at("d").peek().disabled).toBe(false);
    root.at("a").setDisabled(false);
    expect(root.at("a").at("b").at("c").peek().disabled).toBe(false);
  });

  it("does not block writes to a disabled field", () => {
    const { root } = make({ a: 1 }, { disabled: true });
    root.at("a").setValue(2);
    expect(root.at("a").peek()).toMatchObject({ value: 2, disabled: true });
  });

  it("validate and registerValidator go to validation with the handle's path", async () => {
    const { validation, root } = make({ a: 1 });
    const validate = vi.spyOn(validation, "validate");
    const register = vi.spyOn(validation, "register");
    await expect(root.at("a").validate()).resolves.toBe(true);
    root.at("a").registerValidator(check);
    expect(validate).toHaveBeenCalledWith(["a"]);
    expect(register).toHaveBeenCalledWith(["a"], check);
  });

  it("reset stops validation, then resets the baseline at the handle's path", () => {
    const { validation, baseline, submit, root } = make({ a: { b: 1 } });
    const order: string[] = [];
    vi.spyOn(validation, "reset").mockImplementation(() => void order.push("validation"));
    const reset = vi.spyOn(baseline, "reset").mockImplementation(() => void order.push("baseline"));
    const abort = vi.spyOn(submit, "abort");
    root.at("a").reset({ to: "initial" });
    expect(order).toEqual(["validation", "baseline"]);
    expect(reset).toHaveBeenCalledWith(["a"], { to: "initial" });
    expect(abort).not.toHaveBeenCalled();
    root.reset();
    expect(abort).toHaveBeenCalledTimes(1);
  });
});

describe("fieldAt", () => {
  it("returns the handle for paths that name a field", () => {
    const { store, root } = make({ rows: [{ tags: ["x"] }], user: { name: "a" }, nothing: null });
    expect(field(store, ["rows", "k0", "tags", "k0"])).toBe(root.at("rows").item("k0").at("tags").item("k0"));
    expect(field(store, ["rows", "k0", "tags", "k0"]).key).toBe("k0");
    expect(field(store, ["user", "missing"])).toBe(root.at("user").at("missing"));
    expect(field(store, ["nothing", "x"])).toBe(root.at("nothing").at("x"));
  });

  it("returns undefined for a path through a leaf or an item key the array never had", () => {
    const { store, root } = make({ rows: [{ t: 1 }], user: { name: "a" } });
    expect(store.fieldAt(["user", "name", "length"])).toBeUndefined();
    expect(store.fieldAt(["rows", "k1"])).toBeUndefined();
    expect(store.fieldAt(["rows", 0])).toBeUndefined();
    root.at("rows").push({ t: 2 });
    expect(store.fieldAt(["rows", "k1"])).toBe(root.at("rows").item("k1"));
  });
});

describe("store commands", () => {
  it("setErrors replaces user errors across the form by dotted name", () => {
    const { store, root } = make({ rows: [{ t: 1 }, { t: 2 }], a: 1 });
    root.at("a").setErrors(err("old"));
    root.at("rows").move(1, 0);
    const runs = count(store, [["a"], ["rows", "k1", "t"]]);
    store.setErrors({ form: err("form"), fields: { "rows.0.t": [err("x"), err("y")], "": err("root"), nope: err("n"), a: undefined } });
    expect(runs).toEqual([1, 1]);
    expect(root.peek().errors).toEqual([err("form"), err("root")]);
    expect(store.getSnapshot(["rows", "k1", "t"]).errors).toEqual([err("x"), err("y")]);
    expect(root.at("a").peek().errors).toEqual([]);
  });

  it("firstInvalid returns the handle of the first enabled invalid field", () => {
    const { core, store, root } = make({ a: 1, rows: [{ t: 1 }] });
    expect(store.firstInvalid()).toBeUndefined();
    core.setValidationErrors("v", ["rows", "k0", "t"], [err("x")]);
    expect(store.firstInvalid()).toBe(root.at("rows").item("k0").at("t"));
  });

  it("validate resolves whether the form has a validation error, for now", async () => {
    const { core, store } = make({ a: 1 });
    await expect(store.validate()).resolves.toBe(true);
    core.setValidationErrors("v", ["a"], [err("x")]);
    await expect(store.validate()).resolves.toBe(false);
  });

  it("reset puts the initial value back and clears state, for now", () => {
    const { core, store, root } = make({ a: { b: 1 } });
    root.at("a").at("b").setValue(2);
    root.at("a").at("b").handleBlur();
    core.setValidationErrors("v", ["a", "b"], [err("x")]);
    store.reset();
    expect(root.at("a").at("b").peek()).toMatchObject({ value: 1, touched: false, edited: false, errors: [] });
  });

  it("peek and batch go to the core", () => {
    const { store, root } = make({ a: 1, b: 1 });
    expect(store.peek()).toBe(store.getFormSnapshot());
    const runs = count(store, [[]]);
    const result = store.batch(() => {
      root.at("a").setValue(2);
      root.at("b").setValue(2);
      return "done";
    });
    expect(result).toBe("done");
    expect(runs).toEqual([1]);
  });
});
