import { describe, expect, it } from "vitest";
import { definePlugin, refuse } from "../plugins.js";
import { bind } from "./bind.js";
import { baselineOnSubmit, dirty } from "./dirty.js";
import { history } from "./history.js";
import { persist } from "./persist.js";
import { rebase } from "./rebase.js";
import { testStore } from "./testing.js";
import { validation } from "./validation.js";

const profile = () => ({ name: "ada", email: "ada@example.com" });
const list = () => ({ tags: ["a", "b"] });
const nothing = () => {};

function gate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => (open = resolve));
  return { promise, open };
}

/** An `onSubmit` that waits for `finish`. `called` resolves once the form calls it, after the value was read. */
function slowSave() {
  const called = gate();
  const done = gate();
  let calls = 0;
  const onSubmit = () => {
    calls++;
    called.open();
    return done.promise;
  };
  return { onSubmit, called: called.promise, finish: done.open, calls: () => calls };
}

describe("baselineOnSubmit", () => {
  it("leaves the form clean after a successful save", async () => {
    const { store, errors } = testStore({ defaultValues: profile(), plugins: [dirty(), baselineOnSubmit()], onSubmit: () => "saved" });
    store.root.at("name").setValue("grace");
    expect(store.getFormSnapshot().dirty).toBe(true);
    expect(await store.submit()).toEqual({ status: "succeeded", result: "saved" });
    expect(store.getFormSnapshot().dirty).toBe(false);
    store.reset();
    expect(store.getSnapshot([]).value).toEqual({ name: "grace", email: "ada@example.com" });
    expect(errors).toEqual([]);
  });

  it("keeps a field edited while the save ran dirty, with its newer text", async () => {
    const saving = slowSave();
    const { store } = testStore({ defaultValues: profile(), plugins: [dirty(), baselineOnSubmit()], onSubmit: saving.onSubmit });
    store.root.at("name").setValue("grace");
    store.root.at("email").setValue("grace@example.com");
    const done = store.submit();
    await saving.called;
    store.root.at("name").setValue("grace h");
    saving.finish();
    await done;
    expect(store.getSnapshot([]).value).toEqual({ name: "grace h", email: "grace@example.com" });
    expect(store.getSnapshot(["name"]).dirty).toBe(true);
    expect(store.getSnapshot(["email"]).dirty).toBe(false);
    // Typing the saved text back makes the form clean.
    store.root.at("name").setValue("grace");
    expect(store.getFormSnapshot().dirty).toBe(false);
  });

  it("takes an edit made while validation ran as saved, since it was sent", async () => {
    const checking = gate();
    let sent: unknown;
    const { store } = testStore({
      defaultValues: profile(),
      plugins: [validation(), dirty(), baselineOnSubmit()],
      validate: { fields: { email: () => checking.promise.then(() => undefined) } },
      onSubmit: (value) => void (sent = value),
    });
    const done = store.submit();
    await Promise.resolve();
    store.root.at("name").setValue("grace");
    checking.open();
    await done;
    expect(sent).toEqual({ name: "grace", email: "ada@example.com" });
    expect(store.getFormSnapshot().dirty).toBe(false);
  });

  it("moves nothing when the submit ends invalid, refused or failed", async () => {
    const refusing = definePlugin({ name: "refusing", setup: () => ({ onSubmit: () => refuse }) });
    const cases = [
      testStore({
        defaultValues: profile(),
        plugins: [validation(), dirty(), baselineOnSubmit()],
        validate: { fields: { email: (value) => (value.includes("@") ? undefined : { message: "Email" }) } },
      }),
      testStore({ defaultValues: profile(), plugins: [dirty(), baselineOnSubmit(), refusing] }),
      testStore({
        defaultValues: profile(),
        plugins: [dirty(), baselineOnSubmit()],
        onSubmit: () => {
          throw new Error("down");
        },
      }),
      testStore({ defaultValues: profile(), plugins: [dirty(), baselineOnSubmit()], onSubmit: () => Promise.reject(new Error("down")) }),
    ];
    const statuses: string[] = [];
    for (const { store } of cases) {
      store.root.at("email").setValue("grace");
      statuses.push((await store.submit()).status);
      expect(store.getSnapshot(["email"]).dirty).toBe(true);
      store.reset();
      expect(store.getSnapshot(["email"]).value).toBe("ada@example.com");
    }
    expect(statuses).toEqual(["invalid", "invalid", "failed", "failed"]);
  });

  it("moves nothing when a reset aborts the save", async () => {
    const saving = slowSave();
    const { store } = testStore({ defaultValues: profile(), plugins: [dirty(), baselineOnSubmit()], onSubmit: saving.onSubmit });
    store.root.at("name").setValue("grace");
    const done = store.submit();
    await saving.called;
    store.reset();
    saving.finish();
    expect(await done).toEqual({ status: "idle" });
    store.root.at("name").setValue("grace");
    expect(store.getSnapshot(["name"]).dirty).toBe(true);
  });

  it("joins a second submit to the running one, and saves once", async () => {
    const saving = slowSave();
    const { store } = testStore({ defaultValues: profile(), plugins: [dirty(), baselineOnSubmit()], onSubmit: saving.onSubmit });
    store.root.at("name").setValue("grace");
    const first = store.submit();
    await saving.called;
    store.root.at("email").setValue("grace@example.com");
    const second = store.submit();
    expect(second).toBe(first);
    saving.finish();
    await first;
    expect(saving.calls()).toBe(1);
    expect(store.getSnapshot(["name"]).dirty).toBe(false);
    // The second call sent nothing new, so the later edit stays dirty.
    expect(store.getSnapshot(["email"]).dirty).toBe(true);
  });

  it("moves the baseline without dirty(), so reset goes to the saved value", async () => {
    const { store, errors } = testStore({ defaultValues: profile(), plugins: [baselineOnSubmit()] });
    store.root.at("name").setValue("grace");
    await store.submit();
    store.root.at("name").setValue("other");
    store.reset();
    expect(store.getSnapshot(["name"]).value).toBe("grace");
    expect(errors).toEqual([]);
  });
});

describe("arrays saved while the user changes them", () => {

  /** Saves the form while `during` runs, and returns each item's dirty flag after. */
  async function saveWhile(before: (tags: TagsHandle) => void, during: (tags: TagsHandle) => void) {
    const saving = slowSave();
    const { store } = testStore({ defaultValues: list(), plugins: [dirty(), baselineOnSubmit()], onSubmit: saving.onSubmit });
    const tags = store.root.at("tags");
    before(tags);
    const saved = store.getSnapshot(["tags"]).value;
    const done = store.submit();
    await saving.called;
    during(tags);
    saving.finish();
    await done;
    const flags = tags.peek().keys.map((key) => [store.getSnapshot(["tags", key]).value, store.getSnapshot(["tags", key]).dirty]);
    store.reset();
    expect(store.getSnapshot(["tags"]).value).toEqual(saved);
    return flags;
  }
  type TagsHandle = ReturnType<ReturnType<typeof testStore<{ tags: string[] }>>["store"]["root"]["at"]>;

  it("keeps an item inserted at the front dirty and the saved ones clean", async () => {
    expect(await saveWhile(nothing, (tags) => tags.insert(0, "x"))).toEqual([
      ["x", true],
      ["a", false],
      ["b", false],
    ]);
  });

  it("pairs by the keys sent, even when items were added since the last baseline", async () => {
    const flags = await saveWhile(
      (tags) => tags.push("c"),
      (tags) => tags.insert(0, "x"),
    );
    expect(flags).toEqual([
      ["x", true],
      ["a", false],
      ["b", false],
      ["c", false],
    ]);
  });

  it("keeps the items left clean when one is removed", async () => {
    expect(await saveWhile(nothing, (tags) => tags.remove(0))).toEqual([["b", false]]);
  });

  it("keeps moved items clean, though the array is dirty", async () => {
    const saving = slowSave();
    const { store } = testStore({ defaultValues: list(), plugins: [dirty(), baselineOnSubmit()], onSubmit: saving.onSubmit });
    const done = store.submit();
    await saving.called;
    store.root.at("tags").move(0, 1);
    saving.finish();
    await done;
    const keys = store.root.at("tags").peek().keys;
    expect(keys.map((key) => store.getSnapshot(["tags", key]).dirty)).toEqual([false, false]);
    expect(store.getSnapshot(["tags"]).dirty).toBe(true);
  });

  it("pairs arrays inside items too", async () => {
    const saving = slowSave();
    const { store } = testStore({
      defaultValues: { rows: [{ title: "r", tags: ["a"] }] },
      plugins: [dirty(), baselineOnSubmit()],
      onSubmit: saving.onSubmit,
    });
    const rows = store.root.at("rows");
    const [row] = rows.peek().keys;
    if (row === undefined) throw new Error("one row");
    rows.item(row).at("tags").push("b");
    const done = store.submit();
    await saving.called;
    rows.insert(0, { title: "new", tags: [] });
    rows.item(row).at("tags").insert(0, "x");
    saving.finish();
    await done;
    const tags = rows.item(row).at("tags");
    expect(tags.peek().keys.map((key) => store.getSnapshot(tags.item(key).path).dirty)).toEqual([true, false, false]);
    expect(store.getSnapshot(rows.item(rows.peek().keys[0] ?? "").path).dirty).toBe(true);
  });
});

describe("with other plugins", () => {
  it("records no undo step and changes no value with history", async () => {
    const { store, flush, errors } = testStore({ defaultValues: profile(), plugins: [dirty(), history(), baselineOnSubmit()] });
    store.root.at("name").setValue("grace");
    flush();
    await store.submit();
    flush();
    expect(store.getSnapshot([]).value).toEqual({ name: "grace", email: "ada@example.com" });
    expect(store.getFormSnapshot().dirty).toBe(false);
    // One step, the user's edit.
    expect(store.plugins.history.undo()).toBe(true);
    expect(store.getSnapshot(["name"]).value).toBe("ada");
    expect(store.plugins.history.undo()).toBe(false);
    expect(store.getFormSnapshot().dirty).toBe(true);
    expect(errors).toEqual([]);
  });

  it("lets rebase bring in a server value that differs from the one saved", async () => {
    const { store, errors } = testStore({
      defaultValues: profile(),
      plugins: [dirty(), rebase(), baselineOnSubmit()],
      onSubmit: (value) => ({ ...value, email: value.email.toLowerCase() }),
    });
    store.root.at("email").setValue("GRACE@example.com");
    const submission = await store.submit();
    expect(store.getFormSnapshot().dirty).toBe(false);
    if (submission.status !== "succeeded") throw new Error("saved");
    store.plugins.rebase(store.root, submission.result, (leaf) => (leaf.edited ? "keep" : "take"));
    expect(store.getSnapshot(["email"])).toMatchObject({ value: "GRACE@example.com", dirty: true });
    store.plugins.rebase(store.root, submission.result, () => "take");
    expect(store.getSnapshot(["email"])).toMatchObject({ value: "grace@example.com", dirty: false });
    expect(errors).toEqual([]);
  });

  it("works beside persist and bind", async () => {
    let outside = profile();
    const listeners = new Set<() => void>();
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
      removeItem: (key: string) => void saved.delete(key),
    };
    const { store, listen, flush, errors } = testStore({
      defaultValues: profile(),
      plugins: [
        dirty(),
        persist("profile", storage),
        bind({
          get: () => outside,
          set: (value) => void (outside = value),
          subscribe: (listener) => (listeners.add(listener), () => listeners.delete(listener)),
        }),
        baselineOnSubmit(),
      ],
    });
    const stop = listen();
    store.root.at("name").setValue("grace");
    await store.submit();
    flush();
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(outside).toEqual({ name: "grace", email: "ada@example.com" });
    stop();
    expect(errors).toEqual([]);
  });
});
