import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { ErrorMap, FormError, MapError, RawError, ShowContext, ShowMode } from "../errors.js";
import type { Path } from "../path.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import type { FormStore } from "../store.js";
import type { Validator } from "../validator.js";
import { dirty } from "../plugins/dirty.js";
import { createFormStore, type FormStoreOptions } from "./form-store.js";
import { arrays } from "../plugins/arrays.js";

interface Value {
  name: string;
  rows: { title: string }[];
}

const initial: Value = { name: "", rows: [{ title: "" }, { title: "" }] };

const plugins = [dirty()];

const make = (options: Omit<FormStoreOptions<Value>, "id" | "initial"> = {}, value: Value = initial) =>
  createFormStore<Value>({ id: "f", initial: value, plugins: [arrays(), ...plugins], ...options });

const err = (message: string): FormError => ({ message });
const required = (value: unknown) => (value === "" ? err("Required") : undefined);
const tagged: MapError<string> = (raw) => `${raw.source}: ${raw.message}`;
const short: Validator<string, string> = (value) => (value.length < 2 ? "Too short" : undefined);

/** A Standard Schema whose result is fixed. */
const failing = (...issues: StandardSchemaV1.Issue[]): StandardSchemaV1<Value> => ({
  "~standard": { version: 1, vendor: "fake", validate: () => ({ issues }) },
});

const keys = <E>(store: FormStore<Value, E>) => store.getSnapshot(["rows"]).keys ?? [];
const title = <E>(store: FormStore<Value, E>, i: number): Path => ["rows", keys(store)[i] ?? "", "title"];
const messages = (store: FormStore<Value>, path: Path) => store.getSnapshot(path).errors.map((error) => error.message);

describe("error type", () => {
  it("is { message } by default, for schema issues and thrown validators", async () => {
    const store = make({
      schema: failing({ message: "Bad name", path: ["name"] }),
      validate: {
        fields: {
          rows: [
            {
              title: () => {
                throw new Error("boom");
              },
            },
          ],
        },
      },
    });
    await store.validate();
    expect(store.getSnapshot(["name"]).errors).toEqual([{ message: "Bad name" }]);
    expect(store.getSnapshot(title(store, 0)).errors).toEqual([{ message: "boom" }]);
  });

  it("is whatever mapError returns, in snapshots, validators and setErrors", async () => {
    const store = createFormStore<Value, string>({
      id: "f",
      initial,
      plugins,
      mapError: tagged,
      schema: failing({ message: "Bad", path: ["name"] }),
    });
    expectTypeOf(store.getSnapshot(["name"]).errors).toEqualTypeOf<readonly string[]>();
    expectTypeOf(store.root.at("name").peek().shownErrors).toEqualTypeOf<readonly string[]>();
    expectTypeOf<Parameters<typeof store.setErrors>[0]>().toEqualTypeOf<ErrorMap<string>>();
    store.root.at("name").registerValidator(short);
    // Type checks only. Never called.
    const wrong = () => {
      // @ts-expect-error: errors are strings in this form
      store.setErrors({ form: { message: "no" } });
      // @ts-expect-error: a validator must return the form's error type
      store.root.at("name").registerValidator(() => ({ message: "no" }));
    };
    expectTypeOf(wrong).toBeFunction();
    // `E` is inferred from mapError too.
    const inferred = createFormStore({ id: "g", initial, mapError: (raw) => raw.message });
    expectTypeOf(inferred.getSnapshot([]).errors).toEqualTypeOf<readonly string[]>();
    await store.validate();
    expect(store.getSnapshot(["name"]).errors).toEqual(["schema: Bad", "Too short"]);
    store.setErrors({ fields: { name: "Server" } });
    expect(store.getSnapshot(["name"]).errors).toEqual(["schema: Bad", "Too short", "Server"]);
  });
});

describe("mapError", () => {
  it("gets a RawSchemaError per issue, with the stable path the issue lands on", async () => {
    const issue = { message: "Bad title", path: ["rows", { key: 1 }, "title"] };
    const root = { message: "Bad form" };
    const mapError = vi.fn<MapError<FormError>>((raw) => ({ message: raw.message }));
    const store = make({ mapError, schema: failing(issue, root) });
    await store.validate();
    const raws = mapError.mock.calls.map(([raw]) => raw);
    expect(raws).toEqual([
      { source: "schema", message: "Bad title", path: title(store, 1), issue },
      { source: "schema", message: "Bad form", path: [], issue: root },
    ]);
    expect(raws[0]?.source === "schema" && raws[0].issue).toBe(issue);
    expect(messages(store, title(store, 1))).toEqual(["Bad title"]);
  });

  it("lands an issue whose path names no field on the validated field", async () => {
    const issue = { message: "Lost", path: ["rows", 9, "title"] };
    const mapError = vi.fn<MapError<FormError>>((raw) => ({ message: raw.message }));
    const store = make({ mapError, schema: failing(issue) });
    await store.validate();
    expect(mapError.mock.calls[0]?.[0]).toMatchObject({ source: "schema", path: [] });
    expect(messages(store, [])).toEqual(["Lost"]);
  });

  it("gets a RawThrownError for a validator that throws or rejects, with the validator's path", async () => {
    const thrown = new Error("thrown");
    const rejected = "rejected";
    const mapError = vi.fn<MapError<FormError>>((raw) => ({ message: raw.message }));
    const store = make({
      mapError,
      validate: {
        fields: {
          name: () => {
            throw thrown;
          },
          rows: [{ title: () => Promise.reject(rejected) }],
        },
      },
    });
    await store.validate();
    const raws = new Map(mapError.mock.calls.map(([raw]): [string, RawError] => [JSON.stringify(raw.path), raw]));
    expect(raws.get(JSON.stringify(["name"]))).toEqual({ source: "thrown", message: "thrown", path: ["name"], cause: thrown });
    expect(raws.get(JSON.stringify(title(store, 1)))).toEqual({
      source: "thrown",
      message: "rejected",
      path: title(store, 1),
      cause: rejected,
    });
    expect(mapError).toHaveBeenCalledTimes(3);
  });

  it("is not asked for errors a validator returns or the app sets", async () => {
    const mapError = vi.fn<MapError<FormError>>((raw) => ({ message: raw.message }));
    const store = make({ mapError, validate: { fields: { name: required } } });
    await store.validate();
    store.setErrors({ form: err("app") });
    store.root.at("name").setErrors(err("app"));
    expect(mapError).not.toHaveBeenCalled();
  });
});

describe("two sources", () => {
  it("lists validation errors first, then user errors, and counts only validation errors as invalid", async () => {
    const store = make({ validate: { fields: { name: required } } });
    store.root.at("name").setErrors([err("user 1"), err("user 2")]);
    expect(store.getSnapshot(["name"])).toMatchObject({ invalid: false });
    expect(store.getFormSnapshot().valid).toBe(true);
    await store.validate();
    expect(messages(store, ["name"])).toEqual(["Required", "user 1", "user 2"]);
    expect(store.getSnapshot(["name"]).invalid).toBe(true);
    expect(store.getFormSnapshot().valid).toBe(false);
    store.root.at("name").setValue("ok", { edited: false });
    await store.validate();
    expect(messages(store, ["name"])).toEqual(["user 1", "user 2"]);
    expect(store.getSnapshot(["name"]).invalid).toBe(false);
    expect(store.getFormSnapshot().valid).toBe(true);
  });

  it("lets validation errors block submit and user errors not", async () => {
    const onSubmit = vi.fn<() => void>();
    const store = make({ onSubmit, validate: { fields: { name: required } } }, { ...initial, name: "ok" });
    store.setErrors({ fields: { name: err("user") } });
    expect((await store.submit()).status).toBe("succeeded");
    store.root.at("name").setValue("");
    expect((await store.submit()).status).toBe("invalid");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("clears user errors at and below a user-edit write, and nowhere else", () => {
    const store = make();
    store.setErrors({
      form: err("form"),
      fields: { name: err("name"), rows: err("rows"), "rows.0": err("row 0"), "rows.0.title": err("title 0"), "rows.1.title": err("title 1") },
    });
    const row0: Path = ["rows", keys(store)[0] ?? ""];
    store.root.at("rows").item(keys(store)[0] ?? "").at("title").setValue("x");
    expect(messages(store, title(store, 0))).toEqual([]);
    expect(messages(store, row0)).toEqual(["row 0"]);
    expect(messages(store, title(store, 1))).toEqual(["title 1"]);
    store.root.at("rows").push({ title: "" });
    expect(messages(store, ["rows"])).toEqual([]);
    expect(messages(store, row0)).toEqual([]);
    expect(messages(store, title(store, 1))).toEqual([]);
    expect(messages(store, [])).toEqual(["form"]);
    expect(messages(store, ["name"])).toEqual(["name"]);
  });

  it("keeps user errors through a write that is not a user edit", () => {
    const store = make();
    store.root.at("name").setErrors(err("user"));
    store.root.at("name").setValue("loaded", { edited: false });
    store.root.setValue({ name: "again" }, { edited: false });
    expect(messages(store, ["name"])).toEqual(["user"]);
    store.root.at("name").setValue("typed");
    expect(messages(store, ["name"])).toEqual([]);
  });

  it("makes store.setErrors replace every user error, including ones a handle set", () => {
    const store = make();
    store.root.at("name").setErrors(err("handle"));
    store.setErrors({ form: err("a"), fields: { "": err("b"), "rows.1.title": [err("c"), err("d")], "rows.0.title": undefined } });
    expect(messages(store, ["name"])).toEqual([]);
    expect(messages(store, [])).toEqual(["a", "b"]);
    expect(messages(store, title(store, 1))).toEqual(["c", "d"]);
    store.setErrors({});
    expect(messages(store, [])).toEqual([]);
    expect(messages(store, title(store, 1))).toEqual([]);
  });

  it("puts a user error whose name resolves to no field on the root, after the form errors", () => {
    const store = make();
    store.setErrors({ fields: { "rows.5.title": err("lost"), "name.deep": err("leaf") }, form: err("form") });
    expect(messages(store, [])).toEqual(["form", "lost", "leaf"]);
  });

  it("puts a thrown submit error on submission.error and on no field", async () => {
    const boom = { reason: "server" };
    const store = make({ onSubmit: () => Promise.reject(boom) });
    const submission = await store.submit();
    expect(submission.status === "failed" && submission.error).toBe(boom);
    for (const path of [[], ["name"], ["rows"], title(store, 0)]) expect(store.getSnapshot(path).errors).toEqual([]);
  });
});

describe("shown errors", () => {
  // What each mode shows in four states: untouched before submit, touched, submitted, both.
  const table: [ShowMode, boolean[]][] = [
    ["always", [true, true, true, true]],
    ["touched", [false, true, false, true]],
    ["submitted", [false, false, true, true]],
    ["touched-or-submitted", [false, true, true, true]],
  ];

  for (const [show, expected] of table)
    it(`follows "${show}", and always shows user errors`, async () => {
      const states: [boolean, boolean][] = [
        [false, false],
        [true, false],
        [false, true],
        [true, true],
      ];
      const seen: boolean[] = [];
      for (const [touch, submit] of states) {
        // Validators run on submit so a blur alone puts no error anywhere else.
        const store = make({ show, validate: { on: "submit", fields: { name: required } } });
        await store.validate();
        if (touch) store.root.at("name").handleBlur();
        if (submit) await store.submit();
        store.root.at("rows").setErrors(err("user"));
        expect(messages(store, ["name"])).toEqual(["Required"]);
        expect(store.getSnapshot(["rows"]).shownErrors).toEqual([err("user")]);
        seen.push(store.getSnapshot(["name"]).shownErrors.length > 0);
      }
      expect(seen).toEqual(expected);
    });

  it("shows user errors beside hidden validation errors", async () => {
    const store = make({ show: "submitted", validate: { fields: { name: required } } });
    await store.validate();
    store.root.at("name").setErrors(err("user"));
    expect(store.getSnapshot(["name"]).errors).toEqual([err("Required"), err("user")]);
    expect(store.getSnapshot(["name"]).shownErrors).toEqual([err("user")]);
  });

  it("asks a show function with the field's context, again when an input changes", async () => {
    const show = vi.fn<(ctx: ShowContext) => boolean>((ctx) => ctx.touched || ctx.submitCount > 0);
    const store = make({ show, validate: { fields: { name: required } } });
    const name = store.root.at("name");
    await store.validate();
    expect(store.getSnapshot(["name"]).shownErrors).toEqual([]);
    expect(show).toHaveBeenLastCalledWith({ touched: false, edited: false, dirty: false, submitCount: 0 });
    // Edited, and back to the baseline so not dirty.
    name.setValue("a");
    name.setValue("");
    expect(show).toHaveBeenLastCalledWith({ touched: false, edited: true, dirty: false, submitCount: 0 });
    name.handleBlur();
    expect(show).toHaveBeenLastCalledWith({ touched: true, edited: true, dirty: false, submitCount: 0 });
    expect(store.getSnapshot(["name"]).shownErrors).toEqual([err("Required")]);

    const other = make({ show, validate: { fields: { name: required } } });
    await other.validate();
    expect(other.getSnapshot(["name"]).shownErrors).toEqual([]);
    other.root.at("name").setValue("b", { edited: false });
    expect(show).toHaveBeenLastCalledWith(expect.objectContaining({ dirty: true }));
    other.root.at("name").setValue("", { edited: false });
    void other.submit();
    expect(show).toHaveBeenLastCalledWith(expect.objectContaining({ submitCount: 1 }));
    expect(other.getSnapshot(["name"]).shownErrors).toEqual([err("Required")]);
  });

  it("uses a show function to hide errors too", async () => {
    const store = make({ show: (ctx) => ctx.edited, validate: { fields: { name: required } } });
    await store.validate();
    expect(store.getSnapshot(["name"]).shownErrors).toEqual([]);
    store.root.at("name").setValue("a");
    store.root.at("name").setValue("");
    expect(store.getSnapshot(["name"]).shownErrors).toEqual([err("Required")]);
  });
});
