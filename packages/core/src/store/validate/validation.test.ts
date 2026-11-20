import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrorMap, FormError, RawError } from "../../errors.js";
import type { Path } from "../../path.js";
import type { StandardSchemaV1 } from "../../standard-schema.js";
import type { PlatformAbortSignal } from "../../value.js";
import { createFormInternals, type FormStoreOptions } from "../form-store.js";
import { arrays } from "../../plugins/arrays.js";

type Options<V> = Omit<FormStoreOptions<V>, "id" | "initial">;

// Core declares no timer globals, so the tests declare the one they use.
declare function setTimeout(run: () => void, ms: number): unknown;

/** A field check, typed for `vi.fn`. */
type Check = (value: unknown) => FormError | undefined;

const make = <V>(initial: V, options: Options<V> = {}) => {
  const parts = createFormInternals<V>({ id: "f", initial, plugins: [arrays()], ...options });
  const root = parts.store.fieldAt([]);
  if (!root) throw new Error("no root");
  const messages = (path: Path) => parts.store.getSnapshot(path).errors.map((error) => error.message);
  const validating = (path: Path) => parts.store.getSnapshot(path).validating;
  return { ...parts, root, messages, validating };
};

const err = (message: string): FormError => ({ message });

/** A hand-written Standard Schema. */
const schema = <T = unknown>(
  validate: (value: unknown) => StandardSchemaV1.Result<unknown> | Promise<StandardSchemaV1.Result<unknown>>,
): StandardSchemaV1<T, unknown> => ({ "~standard": { version: 1, vendor: "fake", validate } });

/** A failing schema result from `[message, path?]` pairs. */
const issues = (...list: [string, StandardSchemaV1.Issue["path"]?][]): StandardSchemaV1.Result<unknown> => ({
  issues: list.map(([message, path]) => (path ? { message, path } : { message })),
});

const required = (value: unknown) => (value === "" ? err("Required") : undefined);

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

describe("no side effects", () => {
  it("runs nothing and schedules no timer at creation or registration", () => {
    const check = vi.fn<Check>(() => err("No"));
    const formCheck = vi.fn<() => ErrorMap<FormError>>(() => ({ form: err("No") }));
    const { store, root } = make(
      { name: "", rows: [{ t: "" }] },
      {
        timing: "input",
        schema: schema(() => {
          check("");
          return issues(["No"]);
        }),
        validate: { form: { validate: formCheck, debounce: 50 }, fields: { name: check, rows: [{ t: { validate: check, debounce: 10 } }] } },
      },
    );
    const remove = root.at("name").registerValidator({ validate: check, debounce: 10, on: "input" });
    store.registerValidator(["rows"], check);
    expect(check).not.toHaveBeenCalled();
    expect(formCheck).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    remove();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("timing", () => {
  it("waits for blur by default, then runs on every input", () => {
    const { root, messages } = make({ name: "" });
    const check = vi.fn<Check>(required);
    root.at("name").registerValidator(check);
    root.at("name").setValue("a");
    root.at("name").setValue("");
    expect(check).not.toHaveBeenCalled();
    root.at("name").handleBlur();
    expect(messages(["name"])).toEqual(["Required"]);
    root.at("name").setValue("x");
    expect(messages(["name"])).toEqual([]);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("runs on the first touching write under input timing", () => {
    const { root, messages } = make({ name: "a" }, { timing: "input" });
    root.at("name").registerValidator(required);
    root.at("name").setValue("");
    expect(messages(["name"])).toEqual(["Required"]);
  });

  it("does not run on a write that is not a user edit", () => {
    const check = vi.fn<Check>(required);
    const { root, messages } = make({ name: "a" }, { timing: "input" });
    root.at("name").registerValidator(check);
    root.at("name").setValue("", { edited: false });
    expect(check).not.toHaveBeenCalled();
    expect(messages(["name"])).toEqual([]);
  });

  it("waits for submit under submit timing, then runs on input", async () => {
    const { root, validation, messages } = make({ name: "" }, { timing: "submit" });
    root.at("name").registerValidator(required);
    root.at("name").handleBlur();
    root.at("name").setValue("b");
    root.at("name").setValue("");
    expect(messages(["name"])).toEqual([]);
    await validation.settleForSubmit();
    expect(messages(["name"])).toEqual(["Required"]);
    root.at("name").setValue("ok");
    expect(messages(["name"])).toEqual([]);
  });

  it("lets validate.on override the shared timing, and a validator's on override both", () => {
    const { root, messages } = make(
      { a: "x", b: "x" },
      { timing: "submit", validate: { on: "input", fields: { a: required, b: { validate: required, on: "blur" } } } },
    );
    root.at("a").setValue("");
    root.at("b").setValue("");
    expect(messages(["a"])).toEqual(["Required"]);
    expect(messages(["b"])).toEqual([]);
    root.at("b").handleBlur();
    expect(messages(["b"])).toEqual(["Required"]);
  });

  it("runs a validator on writes at, above and below its field, not beside it", () => {
    const check = vi.fn<Check>(() => undefined);
    const { root } = make({ user: { name: "", age: 1 }, other: 1 }, { timing: "input" });
    root.at("user").registerValidator(check);
    root.at("other").setValue(2);
    expect(check).toHaveBeenCalledTimes(0);
    root.at("user").at("name").setValue("a");
    root.setValue({ user: { name: "b", age: 1 } });
    root.at("user").setValue({ age: 2 });
    expect(check).toHaveBeenCalledTimes(3);
  });

  it("blur arms only the validators at exactly that field", () => {
    const check = vi.fn<Check>(() => undefined);
    const { root } = make({ user: { name: "" } });
    root.at("user").registerValidator(check);
    root.at("user").at("name").handleBlur();
    root.at("user").at("name").setValue("a");
    expect(check).not.toHaveBeenCalled();
  });
});

describe("batching", () => {
  it("puts sync errors in the snapshot within the write, one wake per subscription", () => {
    const { store, root } = make({ name: "a" }, { timing: "input", validate: { form: () => ({ form: err("Form") }) } });
    root.at("name").registerValidator(required);
    const seen: string[][] = [];
    const listener = vi.fn<() => void>(() => void seen.push(store.getSnapshot(["name"]).errors.map((e) => e.message)));
    const top = vi.fn<() => void>();
    const form = vi.fn<() => void>();
    store.subscribe(["name"], listener);
    store.subscribe([], top);
    store.subscribeForm(form);
    root.at("name").setValue("");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(top).toHaveBeenCalledTimes(1);
    expect(form).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([["Required"]]);
    expect(store.getFormSnapshot().valid).toBe(false);
  });

  it("does not break the write when a validator throws", () => {
    const { store, root, messages } = make({ name: "a" }, { timing: "input" });
    root.at("name").registerValidator(() => {
      throw new Error("Boom");
    });
    root.at("name").setValue("b");
    expect(store.getSnapshot(["name"]).value).toBe("b");
    expect(messages(["name"])).toEqual(["Boom"]);
  });

  it("lets pending runs finish while nothing is subscribed", async () => {
    const { store, root, messages } = make({ name: "a" }, { timing: "input" });
    root.at("name").registerValidator((value) => new Promise((resolve) => setTimeout(() => resolve(err(String(value))), 10)));
    const off = store.subscribe(["name"], () => {});
    const offForm = store.subscribeForm(() => {});
    root.at("name").setValue("b");
    off();
    offForm();
    await vi.advanceTimersByTimeAsync(10);
    const listener = vi.fn<() => void>();
    store.subscribe(["name"], listener);
    expect(messages(["name"])).toEqual(["b"]);
    root.at("name").setValue("c");
    await vi.advanceTimersByTimeAsync(10);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(messages(["name"])).toEqual(["c"]);
  });
});

describe("errors from throws and schemas", () => {
  it("uses the raw message without mapError", async () => {
    const { root, messages } = make({ a: 1, b: 1 }, { timing: "input" });
    root.at("a").registerValidator(() => {
      throw "plain";
    });
    root.at("b").registerValidator(() => Promise.reject(new Error("Network")));
    root.setValue({ a: 2, b: 2 });
    await vi.runAllTimersAsync();
    expect(messages(["a"])).toEqual(["plain"]);
    expect(messages(["b"])).toEqual(["Network"]);
  });

  it("sends throws, rejections and schema issues through mapError", async () => {
    const raws: RawError[] = [];
    const mapError = (raw: RawError) => {
      raws.push(raw);
      return { message: `${raw.source}:${raw.message}` };
    };
    const cause = new Error("Boom");
    const { root, messages } = make({ a: 1, b: 1, c: 1 }, { timing: "input", mapError });
    root.at("a").registerValidator(() => {
      throw cause;
    });
    root.at("b").registerValidator(() => Promise.reject(new Error("Down")));
    root.at("c").registerValidator(schema(() => issues(["Bad"])));
    root.setValue({ a: 2, b: 2, c: 2 });
    await vi.runAllTimersAsync();
    expect(messages(["a"])).toEqual(["thrown:Boom"]);
    expect(messages(["b"])).toEqual(["thrown:Down"]);
    expect(messages(["c"])).toEqual(["schema:Bad"]);
    expect(raws[0]).toEqual({ source: "thrown", message: "Boom", path: ["a"], cause });
    expect(raws.find((raw) => raw.source === "schema")).toEqual({
      source: "schema",
      message: "Bad",
      path: ["c"],
      issue: { message: "Bad" },
    });
  });

  it("clears a thrown error on the next run that passes", () => {
    let fail = true;
    const { root, messages } = make({ a: 1 }, { timing: "input" });
    root.at("a").registerValidator(() => {
      if (fail) throw new Error("Boom");
    });
    root.at("a").setValue(2);
    expect(messages(["a"])).toEqual(["Boom"]);
    fail = false;
    root.at("a").setValue(3);
    expect(messages(["a"])).toEqual([]);
  });
});

describe("debounce", () => {
  it("waits after the last write and holds validating meanwhile", async () => {
    const { store, root, messages, validating } = make({ name: "" }, { timing: "input" });
    const check = vi.fn<Check>((value) => (value === "taken" ? err("Taken") : undefined));
    root.at("name").registerValidator({ validate: check, debounce: 100 });
    root.at("name").setValue("tak");
    await vi.advanceTimersByTimeAsync(60);
    root.at("name").setValue("taken");
    expect(validating(["name"])).toBe(true);
    expect(store.getFormSnapshot().validating).toBe(true);
    await vi.advanceTimersByTimeAsync(99);
    expect(check).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(check).toHaveBeenCalledTimes(1);
    expect(messages(["name"])).toEqual(["Taken"]);
    expect(validating(["name"])).toBe(false);
    expect(store.getFormSnapshot().validating).toBe(false);
  });

  it("runs a pending debounce at once on submit", async () => {
    const { root, validation, messages } = make({ name: "" }, { timing: "input" });
    const check = vi.fn<Check>(() => err("No"));
    root.at("name").registerValidator({ validate: check, debounce: 500 });
    root.at("name").setValue("x");
    await validation.settleForSubmit();
    expect(check).toHaveBeenCalledTimes(1);
    expect(messages(["name"])).toEqual(["No"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("runs a pending debounce at once on validate()", async () => {
    const { root, messages } = make({ name: "" }, { timing: "input" });
    const check = vi.fn<Check>(() => err("No"));
    root.at("name").registerValidator({ validate: check, debounce: 500 });
    root.at("name").setValue("x");
    expect(await root.at("name").validate()).toBe(false);
    expect(check).toHaveBeenCalledTimes(1);
    expect(messages(["name"])).toEqual(["No"]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("async", () => {
  it("lets the latest run win and aborts the older run's signal", async () => {
    const { root, messages } = make({ name: "" }, { timing: "input" });
    const signals: PlatformAbortSignal[] = [];
    root.at("name").registerValidator((value, { signal }) => {
      signals.push(signal);
      const wait = value === "slow" ? 50 : 10;
      return new Promise((resolve) => setTimeout(() => resolve(err(String(value))), wait));
    });
    root.at("name").setValue("slow");
    root.at("name").setValue("fast");
    await vi.advanceTimersByTimeAsync(10);
    expect(messages(["name"])).toEqual(["fast"]);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(50);
    expect(messages(["name"])).toEqual(["fast"]);
  });

  it("gives the validator its path and the store", () => {
    const { store, root } = make({ user: { name: "" } }, { timing: "input" });
    const check = vi.fn<Check>(() => undefined);
    root.at("user").at("name").registerValidator(check);
    root.at("user").at("name").setValue("a");
    expect(check).toHaveBeenCalledWith("a", expect.objectContaining({ path: ["user", "name"], store }));
  });

  it("shows validating on the field and the form until the result lands", async () => {
    const { store, root, validating } = make({ a: "", b: "" }, { timing: "input" });
    root.at("a").registerValidator(() => new Promise((resolve) => setTimeout(() => resolve(undefined), 20)));
    root.at("a").setValue("x");
    expect(validating(["a"])).toBe(true);
    expect(validating(["b"])).toBe(false);
    expect(store.getFormSnapshot().validating).toBe(true);
    await vi.advanceTimersByTimeAsync(20);
    expect(validating(["a"])).toBe(false);
    expect(store.getFormSnapshot().validating).toBe(false);
  });

  it("wakes each subscription once when an async result lands", async () => {
    const { store, root } = make({ rows: [{ t: "" }] }, { timing: "input" });
    store.registerValidator(
      [],
      schema(() => Promise.resolve(issues(["A", ["rows", 0, "t"]], ["B", ["rows", 0]]))),
    );
    const listener = vi.fn<() => void>();
    const formListener = vi.fn<() => void>();
    root.at("rows").item("k0").at("t").setValue("x");
    store.subscribe(["rows", "k0", "t"], listener);
    store.subscribeForm(formListener);
    await vi.runAllTimersAsync();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(formListener).toHaveBeenCalledTimes(1);
  });
});

describe("standard schema", () => {
  it("puts a field schema's pathless issues on the field and nested ones below it", () => {
    const { root, messages } = make({ user: { name: "", tags: ["a", ""] } }, { timing: "input" });
    root.at("user").registerValidator(
      schema(() => issues(["Whole"], ["Name", ["name"]], ["Tag", ["tags", { key: 1 }]], ["Lost", ["tags", 9]])),
    );
    root.at("user").at("name").setValue("x");
    expect(messages(["user"])).toEqual(["Whole", "Lost"]);
    expect(messages(["user", "name"])).toEqual(["Name"]);
    expect(messages(["user", "tags", "k1"])).toEqual(["Tag"]);
  });

  it("runs the form schema and validate.form together, issues landing by path", () => {
    const { root, messages } = make(
      { rows: [{ t: "a" }, { t: "" }] },
      {
        timing: "input",
        schema: schema(() => issues(["Root"], ["Empty", ["rows", 1, "t"]])),
        validate: { form: schema(() => issues(["Also", ["rows", 1, "t"]])) },
      },
    );
    root.at("rows").move(1, 0);
    // Issue paths use indexes. After the move, index 1 is item k0.
    expect(messages([])).toEqual(["Root"]);
    expect(messages(["rows", "k0", "t"])).toEqual(["Empty", "Also"]);
    expect(messages(["rows", "k1", "t"])).toEqual([]);
  });

  it("drops the errors a schema put on fields that now pass", () => {
    let bad = true;
    const { root, messages } = make(
      { a: "", b: "" },
      { timing: "input", schema: schema(() => (bad ? issues(["A", ["a"]], ["B", ["b"]]) : issues(["B", ["b"]]))) },
    );
    root.at("a").setValue("x");
    expect(messages(["a"])).toEqual(["A"]);
    bad = false;
    root.at("a").setValue("y");
    expect(messages(["a"])).toEqual([]);
    expect(messages(["b"])).toEqual(["B"]);
  });

  it("runs an async schema with latest-wins", async () => {
    const { root, messages } = make(
      { name: "bad" },
      {
        timing: "input",
        schema: schema(
          (value) =>
            new Promise((resolve) => {
              const name = typeof value === "object" && value !== null && "name" in value ? value.name : undefined;
              setTimeout(() => resolve(name === "good" ? { value } : issues(["Bad", ["name"]])), name === "slow" ? 50 : 5);
            }),
        ),
      },
    );
    root.at("name").setValue("slow");
    root.at("name").setValue("good");
    await vi.runAllTimersAsync();
    expect(messages(["name"])).toEqual([]);
  });
});

describe("form validator results", () => {
  it("places an ErrorMap and puts names that resolve to nothing on the root, after the form errors", () => {
    const { root, messages } = make(
      { a: "", rows: [{ t: "" }] },
      {
        timing: "input",
        validate: {
          form: () => ({ form: err("Form"), fields: { a: [err("A1"), err("A2")], "rows.0.t": err("T"), "rows.5.t": err("Gone"), b: undefined } }),
        },
      },
    );
    root.at("a").setValue("x");
    expect(messages([])).toEqual(["Form", "Gone"]);
    expect(messages(["a"])).toEqual(["A1", "A2"]);
    expect(messages(["rows", "k0", "t"])).toEqual(["T"]);
  });

  it("puts a name the value lacks on the root, not on a field nothing renders, and warns once", () => {
    const warn = vi.fn<(message: string) => void>();
    vi.stubGlobal("console", { warn });
    const { store, root, messages } = make({ a: "" }, { timing: "input", validate: { form: () => ({ fields: { nope: err("Renamed") } }) } });
    root.at("a").setValue("x");
    root.at("a").setValue("y");
    vi.unstubAllGlobals();
    expect(messages([])).toEqual(["Renamed"]);
    expect(messages(["nope"])).toEqual([]);
    expect(store.fieldAt(["nope"])).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No field is named "nope"'));
  });

  it("keeps the form invalid when its only error is under a name that resolves to nothing", () => {
    const { store, root, messages } = make({ a: "", rows: [] }, { timing: "input", validate: { form: () => ({ fields: { "rows.0.t": err("Stale") } }) } });
    root.at("a").setValue("x");
    expect(messages([])).toEqual(["Stale"]);
    expect(store.peek().valid).toBe(false);
  });

  it("replaces only its own earlier errors, on every field it wrote", () => {
    let round = 0;
    const { root, messages } = make(
      { a: "", b: "" },
      { timing: "input", validate: { form: () => (round++ === 0 ? { fields: { a: err("A"), b: err("B") } } : { fields: { a: err("A") } }) } },
    );
    root.at("b").registerValidator(() => err("Own"));
    root.setValue({ a: "x", b: "x" });
    // The form validator's owner was added first, so its errors come first.
    expect(messages(["b"])).toEqual(["B", "Own"]);
    root.at("a").setValue("y");
    expect(messages(["a"])).toEqual(["A"]);
    expect(messages(["b"])).toEqual(["Own"]);
  });
});
