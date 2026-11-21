import { describe, expect, it } from "vitest";
import { createFormsCore } from "../forms-core.js";
import type { AttachedPart, NamedPart, Part } from "../plugin.js";
import { definePlugin, refuse } from "../plugins.js";
import { displayOf } from "../store/display.js";
import { dirty } from "./dirty.js";
import { observe, part, text, transform } from "./part.js";
import { testStore } from "./testing.js";

interface Post {
  title: string;
  slug: string;
}

/** Sets the field `name` next to the part's path to `compute` of the value there, each time it changes. */
const derived = <V>(name: string, compute: (value: V) => unknown) =>
  observe<V>((value, ctx) => ctx.write(() => ctx.at(name).setValue(compute(value))));

/** `part` pinned at the dotted name `path`, typed to fit any form, as the test can't type the pin. */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const at = <N extends string>(piece: NamedPart<N>, path: string) => ({ ...piece, path }) as NamedPart<N, unknown>;

const slugify = (title: string) => title.toLowerCase().replace(/\W+/g, "-");

describe("transform", () => {
  it("changes each write and the value there when it attaches, with no plugins installed", () => {
    const store = createFormsCore()
      .define({ defaultValues: { name: " a " } }, at(transform<string>((value) => value.trim()), "name"))
      .createStore();
    expect(store.getSnapshot(["name"]).value).toBe("a");
    store.root.at("name").setValue(" b ");
    expect(store.getSnapshot(["name"]).value).toBe("b");
  });

  it("stops a write it refuses, and sees the write's cause", () => {
    const causes: unknown[] = [];
    const locked = transform<string>((value, write) => {
      causes.push(write.cause);
      return write.cause === "attach" ? value : refuse;
    });
    const { store, errors } = testStore({ defaultValues: { name: "a" } }, at(locked, "name"));
    store.root.at("name").setValue("b");
    expect(store.getSnapshot(["name"]).value).toBe("a");
    expect(causes).toEqual(["attach", "user"]);
    expect(errors).toEqual([]);
  });

  it("runs after every plugin's beforeWrite", () => {
    const suffix = definePlugin({ name: "suffix", setup: () => ({ beforeWrite: (write) => `${String(write.value)}!` }) });
    const { store, errors } = testStore(
      { defaultValues: { name: "" }, plugins: [suffix()] },
      at(transform<string>((value) => value.toUpperCase()), "name"),
    );
    store.root.at("name").setValue("a");
    expect(store.getSnapshot(["name"]).value).toBe("A!");
    expect(errors).toEqual([]);
  });
});

describe("text", () => {
  it("sets the text an input shows, with no plugins installed", () => {
    const store = createFormsCore()
      .define({ defaultValues: { cents: 150 } }, at(text<number>((value) => (value / 100).toFixed(2)), "cents"))
      .createStore();
    const display = displayOf(store.getSnapshot(["cents"]));
    expect(display?.display(150)).toBe("1.50");
    expect(display?.afterInput).toBeUndefined();
    expect(store.getSnapshot(["cents"]).value).toBe(150);
  });
});

describe("observe", () => {
  it("derives a slug from the title when it attaches and on each write", () => {
    const store = createFormsCore()
      .define({ defaultValues: { title: "Hello World", slug: "" } }, derived<Post>("slug", (post) => slugify(post.title)))
      .createStore();
    expect(store.getSnapshot(["slug"]).value).toBe("hello-world");
    store.root.at("title").setValue("Second Post");
    expect(store.getSnapshot(["slug"]).value).toBe("second-post");
  });

  it("keeps a derived field clean when it attaches", () => {
    const { store, errors } = testStore({ defaultValues: { title: "A B", slug: "" }, plugins: [dirty()] }, derived<Post>("slug", (post) => slugify(post.title)));
    expect(store.getSnapshot(["slug"]).value).toBe("a-b");
    store.root.at("title").setValue("C");
    expect(store.getSnapshot(["slug"])).toMatchObject({ value: "c", dirty: true });
    expect(errors).toEqual([]);
  });
});

describe("part", () => {
  it("takes a function of the part's context, which runs at each path it attaches at", () => {
    const paths: unknown[] = [];
    const seen = part<string>((ctx) => {
      paths.push(ctx.path);
      return {};
    });
    testStore({ defaultValues: { a: "", b: "" } }, at(seen, "a"), at(seen, "b"));
    expect(paths).toEqual([["a"], ["b"]]);
  });

  it("lists a part with hooks of its own as `part` in ctx.parts", () => {
    let parts: readonly AttachedPart[] = [];
    const reader = definePlugin({ name: "reader", setup: (ctx) => ({ onWrite: () => void (parts = ctx.parts(["name"])) }) });
    const { store } = testStore({ defaultValues: { name: "" }, plugins: [reader()] }, at(transform<string>((value) => value), "name"));
    store.root.at("name").setValue("a");
    expect(parts).toEqual([{ name: "part", path: ["name"] }]);
  });

  it("passes a plugin's part its config", () => {
    const limit = definePlugin({
      name: "limit",
      part: (_ctx, max: number) => ({ beforeWrite: (write) => (typeof write.value === "string" ? write.value.slice(0, max) : write.value) }),
    });
    const limited: Part<typeof limit, string> = part(limit, 2);
    const { store, errors } = testStore({ defaultValues: { name: "abc" }, plugins: [limit()] }, at(limited, "name"));
    expect(store.getSnapshot(["name"]).value).toBe("ab");
    expect(errors).toEqual([]);
  });
});
