import { describe, expect, it, vi } from "vitest";
import type { FormError, Show } from "../errors.js";
import type { Path } from "../path.js";
import { createStoreCore, type StoreCore, type StoreCoreOptions } from "./core.js";

type Options = Omit<StoreCoreOptions, "id" | "initial">;

const make = (initial: unknown, options: Options = {}) => createStoreCore({ id: "f", initial, ...options });

const err = (message: string): FormError => ({ message });

/** Counts listener calls per path. `"form"` counts form listener calls. */
function count(store: StoreCore, paths: (Path | "form")[]) {
  const runs = paths.map(() => 0);
  const stops = paths.map((path, i) => {
    const listener = () => void (runs[i] = (runs[i] ?? 0) + 1);
    return path === "form" ? store.subscribeForm(listener) : store.subscribe(path, listener);
  });
  return { runs, stop: () => stops.forEach((stop) => stop()) };
}

const snap = (store: StoreCore, path: Path) => store.getSnapshot(path);

describe("touched", () => {
  it("is the field's own flag and replaces only that field's snapshot", () => {
    const store = make({ form: { a: 1, b: 2 } });
    const root = snap(store, []);
    const form = snap(store, ["form"]);
    const b = snap(store, ["form", "b"]);
    const { runs } = count(store, [["form", "a"], ["form", "b"], ["form"], [], "form"]);
    expect(store.setTouched(["form", "a"], true)).toBe(true);
    expect(snap(store, ["form", "a"]).touched).toBe(true);
    expect(snap(store, [])).toBe(root);
    expect(snap(store, ["form"])).toBe(form);
    expect(snap(store, ["form", "b"])).toBe(b);
    expect(runs).toEqual([1, 0, 0, 0, 0]);
    expect(store.setTouched(["form", "a"], true)).toBe(false);
    expect(runs).toEqual([1, 0, 0, 0, 0]);
  });
});

describe("edited", () => {
  it("replaces the field's and each ancestor's snapshot only the first time", () => {
    const store = make({ form: { a: 1, b: 2 } });
    const sibling = snap(store, ["form", "b"]);
    const { runs } = count(store, [["form", "a"], ["form", "b"], ["form"], []]);
    store.markEdited(["form", "a"]);
    expect(snap(store, ["form", "a"]).edited).toBe(true);
    expect(snap(store, ["form"]).edited).toBe(true);
    expect(snap(store, []).edited).toBe(true);
    expect(snap(store, ["form", "b"])).toBe(sibling);
    expect(runs).toEqual([1, 0, 1, 1]);
    const form = snap(store, ["form"]);
    const root = snap(store, []);
    expect(store.markEdited(["form", "a"])).toBe(false);
    store.markEdited(["form", "b"]);
    expect(snap(store, ["form", "b"]).edited).toBe(true);
    expect(snap(store, ["form"])).toBe(form);
    expect(snap(store, [])).toBe(root);
    expect(runs).toEqual([1, 1, 1, 1]);
  });

  it("goes back to false above an edited item when the item is removed", () => {
    const store = make({ rows: [{ t: "a" }, { t: "b" }] });
    store.markEdited(["rows", "k0", "t"]);
    expect(snap(store, ["rows"]).edited).toBe(true);
    store.remove(["rows"], 0);
    expect(snap(store, ["rows"]).edited).toBe(false);
    expect(snap(store, []).edited).toBe(false);
  });

  it("goes back to false above an item dropped by a whole-array replacement", () => {
    const store = make({ rows: [{ t: "a" }, { t: "b" }] });
    store.markEdited(["rows", "k1", "t"]);
    store.set([], { rows: [{ t: "x" }] });
    expect(snap(store, ["rows"]).edited).toBe(false);
    expect(snap(store, []).edited).toBe(false);
  });
});

describe("disabled and read-only", () => {
  it("is the own flag or the parent's, updates nodes below and reaches nodes made later", () => {
    const store = make({ a: { b: { c: 1 } }, other: 1 });
    const c = snap(store, ["a", "b", "c"]);
    const other = snap(store, ["other"]);
    const { runs } = count(store, [["a", "b", "c"], ["other"]]);
    store.setDisabled(["a"], true);
    expect(snap(store, ["a"]).disabled).toBe(true);
    expect(snap(store, ["a", "b", "c"]).disabled).toBe(true);
    expect(snap(store, ["a", "b", "c"])).not.toBe(c);
    expect(snap(store, ["a", "new"]).disabled).toBe(true);
    expect(snap(store, ["other"])).toBe(other);
    expect(snap(store, []).disabled).toBe(false);
    expect(runs).toEqual([1, 0]);
    // An own flag under a disabled parent shows nothing new until the parent clears.
    store.setDisabled(["a", "b"], true);
    expect(runs).toEqual([1, 0]);
    store.setDisabled(["a"], false);
    expect(snap(store, ["a", "b", "c"]).disabled).toBe(true);
    expect(snap(store, ["a", "new"]).disabled).toBe(false);
    store.setDisabled(["a", "b"], false);
    expect(snap(store, ["a", "b", "c"]).disabled).toBe(false);
    expect(runs).toEqual([2, 0]);
  });

  it("keeps the two flags apart", () => {
    const store = make({ a: 1 });
    store.setReadOnly([], true);
    expect(snap(store, ["a"])).toMatchObject({ readOnly: true, disabled: false });
  });

  it("reads initial flags as a boolean, a record and a tuple", () => {
    const store = make(
      { title: "x", address: { city: "a", zip: "b" }, rows: [{ t: "a", n: 1 }] },
      { disabled: { address: true, rows: [{ t: true }] }, readOnly: true },
    );
    expect(snap(store, ["title"])).toMatchObject({ disabled: false, readOnly: true });
    expect(snap(store, ["address"]).disabled).toBe(true);
    expect(snap(store, ["address", "city"]).disabled).toBe(true);
    expect(snap(store, ["rows"]).disabled).toBe(false);
    expect(snap(store, ["rows", "k0"]).disabled).toBe(false);
    expect(snap(store, ["rows", "k0", "t"]).disabled).toBe(true);
    expect(snap(store, ["rows", "k0", "n"]).disabled).toBe(false);
    // The tuple's entry applies to items added later too.
    const key = store.insert(["rows"], 1, { t: "b", n: 2 }) ?? "";
    expect(snap(store, ["rows", key, "t"]).disabled).toBe(true);
  });

  it("follows an item when it moves", () => {
    const store = make({ rows: ["a", "b"] });
    store.setDisabled(["rows", "k0"], true);
    store.move(["rows"], 0, 1);
    expect(snap(store, ["rows", "k0"])).toMatchObject({ disabled: true, name: "rows.1" });
    expect(snap(store, ["rows", "k1"]).disabled).toBe(false);
  });
});

describe("validating", () => {
  it("is true while any owner says so, on the field only", () => {
    const store = make({ a: { b: 1 } });
    const parent = snap(store, ["a"]);
    const { runs } = count(store, [["a", "b"], "form"]);
    store.setValidating("v1", ["a", "b"], true);
    store.setValidating("v2", ["a", "b"], true);
    expect(snap(store, ["a", "b"]).validating).toBe(true);
    expect(snap(store, ["a"])).toBe(parent);
    expect(store.getFormSnapshot().validating).toBe(true);
    expect(runs).toEqual([1, 1]);
    store.setValidating("v1", ["a", "b"], false);
    expect(snap(store, ["a", "b"]).validating).toBe(true);
    expect(runs).toEqual([1, 1]);
    store.setValidating("v2", ["a", "b"], false);
    expect(snap(store, ["a", "b"]).validating).toBe(false);
    expect(store.getFormSnapshot().validating).toBe(false);
    expect(runs).toEqual([2, 2]);
    expect(store.setValidating("v2", ["a", "b"], false)).toBe(false);
  });
});

describe("errors", () => {
  it("joins validation errors in owner order, then user errors", () => {
    const store = make({ a: 1 });
    store.addOwner("first");
    store.addOwner("second");
    const [x, y, u] = [err("x"), err("y"), err("u")];
    store.setValidationErrors("second", ["a"], [y]);
    store.setValidationErrors("first", ["a"], [x]);
    store.setUserErrors(["a"], [u]);
    expect(snap(store, ["a"]).errors).toEqual([x, y, u]);
    expect(snap(store, ["a"]).invalid).toBe(true);
  });

  it("doesn't count user errors as invalid", () => {
    const store = make({ a: 1 });
    store.setUserErrors(["a"], [err("u")]);
    expect(snap(store, ["a"]).invalid).toBe(false);
    expect(store.getFormSnapshot().valid).toBe(true);
  });

  it("keeps the snapshot for an equal list and uses one empty list everywhere", () => {
    const store = make({ a: 1, b: 2 });
    const x = err("x");
    store.setValidationErrors("v", ["a"], [x]);
    const before = snap(store, ["a"]);
    const { runs } = count(store, [["a"], "form"]);
    expect(store.setValidationErrors("v", ["a"], [x])).toBe(false);
    expect(store.setUserErrors(["a"], [])).toBe(false);
    expect(snap(store, ["a"])).toBe(before);
    expect(runs).toEqual([0, 0]);
    store.setValidationErrors("v", ["a"], []);
    expect(snap(store, ["a"]).errors).toBe(snap(store, ["b"]).errors);
    expect(snap(store, ["a"]).shownErrors).toBe(snap(store, ["b"]).errors);
    expect(Object.isFrozen(snap(store, ["b"]).errors)).toBe(true);
  });

  it("copies the caller's list in and freezes only the copy", () => {
    const store = make({ a: 1 });
    const list = [err("x")];
    store.setValidationErrors("v", ["a"], list);
    const user = [err("u")];
    store.setUserErrors(["a"], user);
    expect(Object.isFrozen(list)).toBe(false);
    expect(Object.isFrozen(user)).toBe(false);
    list.push(err("later"));
    user.length = 0;
    expect(snap(store, ["a"]).errors.map((e) => e.message)).toEqual(["x", "u"]);
    expect(Object.isFrozen(snap(store, ["a"]).errors)).toBe(true);
    expect(Object.isFrozen(snap(store, ["a"]).shownErrors)).toBe(true);
  });

  it("removes everything an owner set across the store", () => {
    const store = make({ a: 1, b: 2 });
    store.setValidationErrors("v", ["a"], [err("x")]);
    store.setValidationErrors("w", ["a"], [err("w")]);
    store.setValidating("v", ["b"], true);
    store.setUserErrors(["b"], [err("u")]);
    const { runs } = count(store, [["a"], ["b"], "form"]);
    expect(store.removeOwner("v")).toBe(true);
    expect(snap(store, ["a"]).errors.map((e) => e.message)).toEqual(["w"]);
    expect(snap(store, ["b"])).toMatchObject({ validating: false, errors: [{ message: "u" }] });
    expect(store.getFormSnapshot()).toMatchObject({ valid: false, validating: false });
    expect(runs).toEqual([1, 1, 1]);
    expect(store.removeOwner("v")).toBe(false);
  });

  it("ignores state commands at paths that name no field", () => {
    const store = make({ title: "x", rows: ["a"] });
    expect(store.setTouched(["title", "length"], true)).toBe(false);
    expect(store.setUserErrors(["rows", "nope"], [err("x")])).toBe(false);
    store.remove(["rows"], 0);
    expect(store.setValidationErrors("v", ["rows", "k0"], [err("x")])).toBe(false);
    expect(store.markEdited(["rows", "k0"])).toBe(false);
    expect(store.getFormSnapshot().valid).toBe(true);
  });
});

/** A store whose field `a` has one validation error. */
const withError = (show: Show) => {
  const store = make({ a: 1 }, { show });
  store.setValidationErrors("v", ["a"], [err("x")]);
  return store;
};

const shown = (store: StoreCore) => snap(store, ["a"]).shownErrors.map((e) => e.message);

describe("shown errors", () => {
  it("follows each mode", () => {
    const always = withError("always");
    expect(shown(always)).toEqual(["x"]);

    const touched = withError("touched");
    expect(shown(touched)).toEqual([]);
    touched.setSubmitCount(1);
    expect(shown(touched)).toEqual([]);
    touched.setTouched(["a"], true);
    expect(shown(touched)).toEqual(["x"]);

    const submitted = withError("submitted");
    submitted.setTouched(["a"], true);
    expect(shown(submitted)).toEqual([]);
    submitted.setSubmitCount(1);
    expect(shown(submitted)).toEqual(["x"]);

    const either = withError("touched-or-submitted");
    expect(shown(either)).toEqual([]);
    either.setTouched(["a"], true);
    expect(shown(either)).toEqual(["x"]);
    const other = withError("touched-or-submitted");
    other.setSubmitCount(1);
    expect(shown(other)).toEqual(["x"]);
  });

  it("defaults to touched-or-submitted", () => {
    const store = make({ a: 1 });
    store.setValidationErrors("v", ["a"], [err("x")]);
    expect(shown(store)).toEqual([]);
    store.setTouched(["a"], true);
    expect(shown(store)).toEqual(["x"]);
  });

  it("always shows user errors, and hides validation errors around them", () => {
    const store = withError("submitted");
    store.setUserErrors(["a"], [err("u")]);
    expect(shown(store)).toEqual(["u"]);
    store.setSubmitCount(1);
    expect(shown(store)).toEqual(["x", "u"]);
    expect(snap(store, ["a"]).shownErrors).toBe(snap(store, ["a"]).errors);
  });

  it("asks a show function with the field's context", () => {
    const show = vi.fn<Exclude<Show, string>>((ctx) => ctx.edited && ctx.submitCount > 1);
    const store = withError(show);
    store.setUserErrors(["a"], [err("u")]);
    expect(shown(store)).toEqual(["u"]);
    store.markEdited(["a"]);
    store.setSubmitCount(1);
    expect(shown(store)).toEqual(["u"]);
    store.setSubmitCount(2);
    expect(shown(store)).toEqual(["x", "u"]);
    expect(show).toHaveBeenLastCalledWith({ touched: false, edited: true, dirty: false, submitCount: 2 });
  });

  it("rebuilds only fields with validation errors when the submit count changes", () => {
    const store = make({ a: 1, b: 2, c: 3 });
    store.setValidationErrors("v", ["a"], [err("x")]);
    store.setUserErrors(["b"], [err("u")]);
    const b = snap(store, ["b"]);
    const c = snap(store, ["c"]);
    const root = snap(store, []);
    const { runs } = count(store, [["a"], ["b"], ["c"], []]);
    store.setSubmitCount(1);
    expect(shown(store)).toEqual(["x"]);
    expect(snap(store, ["b"])).toBe(b);
    expect(snap(store, ["c"])).toBe(c);
    expect(snap(store, [])).toBe(root);
    expect(runs).toEqual([1, 0, 0, 0]);
    // A second submit changes nothing a mode can see.
    store.setSubmitCount(2);
    expect(runs).toEqual([1, 0, 0, 0]);
  });
});

describe("clearing state", () => {
  it("clears touched, edited and user errors at and below a path, and validation errors on request", () => {
    const store = make({ a: { b: 1 }, c: 1 });
    store.setTouched(["a", "b"], true);
    store.markEdited(["a", "b"]);
    store.setUserErrors(["a", "b"], [err("u")]);
    store.setValidationErrors("v", ["a", "b"], [err("x")]);
    store.setDisabled(["a", "b"], true);
    store.setValidating("v", ["a", "b"], true);
    store.setTouched(["c"], true);
    const { runs } = count(store, [["a", "b"], ["a"], ["c"]]);
    expect(store.clearState(["a"])).toBe(true);
    expect(runs).toEqual([1, 1, 0]);
    expect(snap(store, ["a", "b"])).toMatchObject({
      touched: false,
      edited: false,
      errors: [{ message: "x" }],
      disabled: true,
      validating: true,
    });
    expect(snap(store, [])).toMatchObject({ edited: false });
    expect(snap(store, ["c"]).touched).toBe(true);
    expect(store.clearState(["a"], { validation: true })).toBe(true);
    expect(snap(store, ["a", "b"]).errors).toEqual([]);
    expect(store.getFormSnapshot().valid).toBe(true);
    expect(store.clearState(["a"], { validation: true })).toBe(false);
    expect(runs).toEqual([2, 1, 0]);
  });

  it("does nothing where no node exists", () => {
    const store = make({ a: 1 });
    expect(store.clearState(["a"])).toBe(false);
    expect(store.stats().nodes).toBe(0);
  });
});

describe("form snapshot", () => {
  it("is built on first read and is the server snapshot until something changes", () => {
    const store = make({ a: 1 });
    expect(store.stats().nodes).toBe(0);
    const server = store.getServerFormSnapshot();
    expect(store.getFormSnapshot()).toBe(server);
    expect(server).toEqual({
      valid: true,
      validating: false,
      dirty: false,
      submitting: false,
      submission: { status: "idle" },
      submitCount: 0,
    });
    expect(store.stats().nodes).toBe(0);
    expect(Object.isFrozen(server)).toBe(true);
  });

  it("keeps its identity until a member changes", () => {
    const store = make({ a: 1, b: 2 });
    const first = store.getFormSnapshot();
    const { runs } = count(store, ["form"]);
    store.set(["a"], 2);
    store.setTouched(["a"], true);
    store.setUserErrors(["a"], [err("u")]);
    store.setValidationErrors("v", ["a"], []);
    expect(store.getFormSnapshot()).toBe(first);
    expect(runs).toEqual([0]);
    store.setValidationErrors("v", ["a"], [err("x")]);
    const invalid = store.getFormSnapshot();
    expect(invalid).not.toBe(first);
    expect(invalid.valid).toBe(false);
    store.setValidationErrors("v", ["b"], [err("y")]);
    expect(store.getFormSnapshot()).toBe(invalid);
    expect(runs).toEqual([1]);
    expect(store.getServerFormSnapshot()).toBe(first);
  });

  it("counts invalid fields, and removed items leave the count", () => {
    const store = make({ rows: [{ t: "a" }, { t: "b" }] });
    store.setValidationErrors("v", ["rows", "k0", "t"], [err("x")]);
    store.setValidationErrors("v", ["rows", "k1"], [err("y")]);
    store.setValidating("v", ["rows", "k1", "t"], true);
    expect(store.getFormSnapshot()).toMatchObject({ valid: false, validating: true });
    store.remove(["rows"], 0);
    expect(store.getFormSnapshot()).toMatchObject({ valid: false, validating: true });
    store.remove(["rows"], 0);
    expect(store.getFormSnapshot()).toMatchObject({ valid: true, validating: false });
    // The owner's later removal finds nothing left to drop.
    expect(store.removeOwner("v")).toBe(false);
  });

  it("sets the submission and submit count", () => {
    const store = make({ a: 1 });
    const { runs } = count(store, ["form"]);
    const submitting = { status: "submitting", intent: undefined } as const;
    store.batch(() => {
      store.setSubmitCount(1);
      store.setSubmission(submitting);
    });
    expect(runs).toEqual([1]);
    expect(store.getFormSnapshot()).toMatchObject({ submitting: true, submission: submitting, submitCount: 1 });
    expect(store.setSubmission(submitting)).toBe(false);
    store.setSubmission({ status: "succeeded", result: 1 });
    expect(store.getFormSnapshot().submitting).toBe(false);
    expect(runs).toEqual([2]);
  });

  it("wakes form and field listeners once each in one flush", () => {
    const store = make({ a: 1 });
    const seen: string[] = [];
    store.subscribeForm(() => seen.push(`form:${String(store.getFormSnapshot().valid)}`));
    store.subscribe(["a"], () => seen.push(`a:${String(snap(store, ["a"]).invalid)}`));
    store.batch(() => {
      store.setValidationErrors("v", ["a"], [err("x")]);
      store.setValidationErrors("w", ["a"], [err("y")]);
      expect(seen).toEqual([]);
    });
    // Cells wake in the order they first changed.
    expect(seen).toEqual(["a:true", "form:false"]);
  });
});

describe("dirty hook", () => {
  it("asks the hook when a value changes and on recheck", () => {
    let baseline = 1;
    const dirty = vi.fn<(path: Path, value: unknown) => boolean>((path, value) => (path.length === 0 ? false : value !== baseline));
    const store = make({ a: 1 }, { dirty });
    expect(snap(store, ["a"]).dirty).toBe(false);
    store.setTouched(["a"], true);
    const calls = dirty.mock.calls.length;
    store.setTouched(["a"], false);
    expect(dirty.mock.calls.length).toBe(calls);
    store.set(["a"], 2);
    expect(snap(store, ["a"]).dirty).toBe(true);
    baseline = 2;
    store.recheckDirty();
    expect(snap(store, ["a"]).dirty).toBe(false);
  });
});

describe("side effects", () => {
  it("makes no nodes at creation, with flags and show given", () => {
    const show = vi.fn<() => boolean>(() => true);
    const store = make({ rows: [{ t: "a" }] }, { disabled: { rows: [true] }, readOnly: true, show });
    expect(store.stats()).toEqual({ nodes: 0, subscribed: 0 });
    expect(show).not.toHaveBeenCalled();
  });
});

describe("server snapshot", () => {
  it("shows initial flags and no state, whatever changed since", () => {
    const store = make({ a: { b: 1 } }, { disabled: { a: true } });
    store.setTouched(["a", "b"], true);
    store.markEdited(["a", "b"]);
    store.setUserErrors(["a", "b"], [err("u")]);
    store.setDisabled(["a"], false);
    store.setReadOnly([], true);
    expect(store.getServerSnapshot(["a", "b"])).toMatchObject({
      disabled: true,
      readOnly: false,
      touched: false,
      edited: false,
      errors: [],
      shownErrors: [],
    });
    expect(snap(store, ["a", "b"])).toMatchObject({ disabled: false, readOnly: true, touched: true });
  });
});

describe("items", () => {
  it("carry their state when they move", () => {
    const store = make({ rows: [{ t: "a" }, { t: "b" }, { t: "c" }] });
    store.setTouched(["rows", "k0", "t"], true);
    store.setValidationErrors("v", ["rows", "k0", "t"], [err("x")]);
    store.move(["rows"], 0, 2);
    expect(snap(store, ["rows", "k0", "t"])).toMatchObject({ touched: true, invalid: true, name: "rows.2.t" });
    expect(snap(store, ["rows", "k1", "t"])).toMatchObject({ touched: false, invalid: false });
    expect(store.pathOf("rows.2.t")).toEqual(["rows", "k0", "t"]);
  });

  it("keep their last snapshot, from just before the removal, with its state", () => {
    const store = make({ rows: [{ t: "a" }, { t: "b" }] });
    store.setTouched(["rows", "k0", "t"], true);
    store.setValidationErrors("v", ["rows", "k0", "t"], [err("x")]);
    const last = snap(store, ["rows", "k0", "t"]);
    store.remove(["rows"], 0);
    expect(snap(store, ["rows", "k0", "t"])).toBe(last);
    expect(last).toMatchObject({ touched: true, invalid: true, name: "rows.0.t" });
    expect(store.removeOwner("v")).toBe(false);
    expect(snap(store, ["rows", "k0", "t"])).toBe(last);
  });

  it("keep state by index through a whole-array replacement, and dropped keys take theirs", () => {
    const store = make({ rows: ["a", "b", "c"] });
    store.setTouched(["rows", "k0"], true);
    store.setValidationErrors("v", ["rows", "k2"], [err("x")]);
    store.set(["rows"], ["x", "y"]);
    expect(snap(store, ["rows", "k0"])).toMatchObject({ value: "x", touched: true });
    expect(store.getFormSnapshot().valid).toBe(true);
    store.set(["rows"], ["x", "y", "z"]);
    expect(snap(store, ["rows", "k3"])).toMatchObject({ value: "z", invalid: false });
  });

  it("let a state change on one row among thousands touch only that row", () => {
    const rows = Array.from({ length: 2000 }, (_, i) => ({ title: `t${i}` }));
    const store = make({ rows });
    const keys = snap(store, ["rows"]).keys ?? [];
    const runs = new Map<string, number>();
    for (const key of keys) store.subscribe(["rows", key, "title"], () => runs.set(key, (runs.get(key) ?? 0) + 1));
    const others = keys.map((key) => snap(store, ["rows", key, "title"]));
    const list = snap(store, ["rows"]);
    store.setTouched(["rows", "k500", "title"], true);
    store.setValidationErrors("v", ["rows", "k500", "title"], [err("x")]);
    store.setSubmitCount(1);
    expect([...runs]).toEqual([["k500", 2]]);
    const replaced = keys.filter((key, i) => snap(store, ["rows", key, "title"]) !== others[i]);
    expect(replaced).toEqual(["k500"]);
    expect(snap(store, ["rows"])).toBe(list);
  });
});

describe("name lookup", () => {
  it("turns a dotted name into a stable path", () => {
    const store = make({ rows: [{ title: "a" }, { title: "b" }], user: { name: "x" }, nothing: null });
    // Before any node exists, keys are the positional ones the list will get.
    expect(store.pathOf("rows.1.title")).toEqual(["rows", "k1", "title"]);
    expect(store.stats().nodes).toBe(0);
    store.insert(["rows"], 0, { title: "new" });
    expect(store.pathOf("rows.0.title")).toEqual(["rows", "k2", "title"]);
    expect(store.pathOf("rows.2")).toEqual(["rows", "k1"]);
    expect(store.pathOf("")).toEqual([]);
    expect(store.pathOf("user.name")).toEqual(["user", "name"]);
    expect(store.pathOf("user.missing")).toEqual(["user", "missing"]);
    expect(store.pathOf("nothing.deeper")).toEqual(["nothing", "deeper"]);
  });

  it("returns undefined when the name does not resolve", () => {
    const store = make({ rows: [{ title: "a" }], user: { name: "x" } });
    expect(store.pathOf("rows.1.title")).toBeUndefined();
    expect(store.pathOf("rows.k0")).toBeUndefined();
    expect(store.pathOf("rows.01")).toBeUndefined();
    expect(store.pathOf("user.name.length")).toBeUndefined();
  });
});

describe("clearing user errors", () => {
  it("clears user errors at and below a path and leaves everything else", () => {
    const store = make({ a: { b: 1 }, c: 1 });
    store.setTouched(["a", "b"], true);
    store.markEdited(["a", "b"]);
    store.setUserErrors(["a"], [err("top")]);
    store.setUserErrors(["a", "b"], [err("u")]);
    store.setValidationErrors("v", ["a", "b"], [err("x")]);
    store.setUserErrors(["c"], [err("c")]);
    const { runs } = count(store, [["a", "b"], ["a"], ["c"]]);
    expect(store.clearUserErrors(["a"])).toBe(true);
    expect(runs).toEqual([1, 1, 0]);
    expect(snap(store, ["a", "b"])).toMatchObject({ touched: true, edited: true, errors: [{ message: "x" }] });
    expect(snap(store, ["a"]).errors).toEqual([]);
    expect(snap(store, ["c"]).errors).toEqual([{ message: "c" }]);
    expect(store.clearUserErrors(["a"])).toBe(false);
    expect(runs).toEqual([1, 1, 0]);
  });

  it("does nothing where no node exists", () => {
    const store = make({ a: 1 });
    expect(store.clearUserErrors(["a"])).toBe(false);
    expect(store.stats().nodes).toBe(0);
  });
});

describe("field lookup", () => {
  it("says whether state can be set at a path", () => {
    const store = make({ rows: [{ t: "a" }], leaf: 1 });
    expect(store.isLive(["rows", "k0", "t"])).toBe(true);
    expect(store.isLive(["missing", "deeper"])).toBe(true);
    expect(store.isLive(["leaf", "x"])).toBe(false);
    expect(store.isLive(["rows", "k1"])).toBe(false);
    store.remove(["rows"], 0);
    expect(store.isLive(["rows", "k0", "t"])).toBe(false);
  });

  it("marks item steps and makes no nodes", () => {
    const store = make({ rows: [{ tags: ["x"] }], user: { name: "a" }, nothing: null });
    expect(store.itemSteps([])).toEqual([]);
    expect(store.itemSteps(["rows", "k0", "tags", "k0"])).toEqual([false, true, false, true]);
    expect(store.itemSteps(["user", "missing", "deeper"])).toEqual([false, false, false]);
    expect(store.itemSteps(["nothing", "x"])).toEqual([false, false]);
    expect(store.stats().nodes).toBe(0);
  });

  it("rejects a step into a leaf and an item key the array never had", () => {
    const store = make({ rows: [{ t: "a" }], user: { name: "a" } });
    expect(store.itemSteps(["user", "name", "length"])).toBeUndefined();
    expect(store.itemSteps(["rows", "k1"])).toBeUndefined();
    expect(store.itemSteps(["rows", 0])).toBeUndefined();
    expect(store.itemSteps(["rows", "x"])).toBeUndefined();
  });

  it("accepts a removed item's key and walks its last value", () => {
    const store = make({ rows: [{ t: "a" }, { t: "b" }] });
    store.getSnapshot(["rows", "k1", "t"]);
    store.remove(["rows"], 1);
    store.remove(["rows"], 0);
    expect(store.itemSteps(["rows", "k1", "t"])).toEqual([false, true, false]);
    expect(store.itemSteps(["rows", "k1", "t", "length"])).toBeUndefined();
    // No node was made for k0, so what was below it is unknown and accepted.
    expect(store.itemSteps(["rows", "k0", "anything"])).toEqual([false, true, false]);
    expect(store.itemSteps(["rows", "k2"])).toBeUndefined();
  });
});

describe("invalid lookup", () => {
  it("says whether a subtree has a validation error, without making nodes", () => {
    const store = make({ a: { b: 1 }, c: 1 });
    expect(store.invalidAt(["a"])).toBe(false);
    expect(store.stats().nodes).toBe(0);
    store.setValidationErrors("v", ["a", "b"], [err("x")]);
    store.setUserErrors(["c"], [err("u")]);
    expect(store.invalidAt([])).toBe(true);
    expect(store.invalidAt(["a"])).toBe(true);
    expect(store.invalidAt(["c"])).toBe(false);
    expect(store.invalidAt(["nope"])).toBe(false);
  });

  it("finds the first enabled invalid field in value order", () => {
    const store = make({ b: 1, a: { x: 1, y: 1 }, rows: [{ t: 1 }, { t: 2 }] });
    expect(store.firstInvalid()).toBeUndefined();
    store.setValidationErrors("v", ["rows", "k1", "t"], [err("x")]);
    store.setValidationErrors("v", ["rows", "k0", "t"], [err("x")]);
    expect(store.firstInvalid()).toEqual(["rows", "k0", "t"]);
    store.move(["rows"], 1, 0);
    expect(store.firstInvalid()).toEqual(["rows", "k1", "t"]);
    store.setValidationErrors("v", ["a", "y"], [err("x")]);
    store.setValidationErrors("v", ["missing"], [err("x")]);
    expect(store.firstInvalid()).toEqual(["a", "y"]);
    store.setValidationErrors("v", ["b"], [err("x")]);
    expect(store.firstInvalid()).toEqual(["b"]);
    store.setUserErrors(["a"], [err("u")]);
    store.setDisabled(["b"], true);
    store.setDisabled(["a"], true);
    expect(store.firstInvalid()).toEqual(["rows", "k1", "t"]);
    store.setDisabled(["rows"], true);
    expect(store.firstInvalid()).toEqual(["missing"]);
    store.setValidationErrors("v", [], [err("form")]);
    expect(store.firstInvalid()).toEqual([]);
  });
});
