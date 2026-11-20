import { createFormsCore, type Path, tracking } from "@lunarhue/forms-core";
import { definePlugin } from "@lunarhue/forms-core/plugins";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cornerKey } from "./panel/corner.js";
import { type Hook, hookKey } from "./hook.js";
import { devtools } from "./index.js";
import { mount } from "./panel.js";
import type { SizeReport } from "./sizes.js";

// The collector mounts the panel itself while a form reads true. Each test
// unsubscribes its forms at the end, which unmounts it.

// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const page = globalThis as { [hookKey]?: Hook };

/** Lets two animation frames pass: Preact runs effects after a frame, and the panel reads on the next one. */
const frame = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0))));

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  document.body.replaceChildren();
  localStorage.clear();
});

/** A form with devtools, subscribed the way an adapter's form is. */
function form<V extends object>(defaultValues: V, id = "form") {
  const store = createFormsCore({ plugins: [devtools()] }).define({ defaultValues }).createStore(undefined, { id });
  const off = store.subscribeForm(() => {});
  cleanups.push(off);
  return store;
}

function hook(): Hook {
  const found = page[hookKey];
  if (!found) throw new Error("No hook on the page.");
  return found;
}

/** Waits for the collector's panel and returns its shadow root. */
async function open(): Promise<ShadowRoot> {
  await frame();
  const hosts = document.querySelectorAll("[data-lunarhue-forms-devtools]");
  expect(hosts).toHaveLength(1);
  const root = hosts[0]?.shadowRoot;
  if (!root) throw new Error("No panel host.");
  return root;
}

const button = (root: ShadowRoot, label: string): HTMLButtonElement => {
  const found = [...root.querySelectorAll("button")].find(
    (element) => element.getAttribute("aria-label") === label || element.textContent === label,
  );
  if (!found) throw new Error(`No button "${label}".`);
  return found;
};

const row = (root: ShadowRoot, path: Path) => root.querySelector(`[data-path='${JSON.stringify(path)}']`);

describe("mount", () => {
  it("puts a host with a shadow root at the end of the body and takes it away when the last form leaves", async () => {
    form({ name: "" });
    const root = await open();
    expect(document.body.lastElementChild?.shadowRoot).toBe(root);
    expect(root.querySelector('[role="toolbar"]')).not.toBeNull();
    for (const cleanup of cleanups.splice(0)) cleanup();
    expect(document.querySelector("[data-lunarhue-forms-devtools]")).toBeNull();
  });

  it("says only that the versions differ for a hook of another version", async () => {
    form({ name: "" });
    await open();
    document.body.replaceChildren();
    const other = { ...hook(), version: 2 };
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    cleanups.push(mount(other as unknown as Hook));
    const root = document.querySelector("[data-lunarhue-forms-devtools]")?.shadowRoot;
    expect(root?.querySelector('[role="status"]')?.textContent).toContain("version 2");
    expect(root?.querySelector('[role="toolbar"]')).toBeNull();
  });
});

describe("dock", () => {
  it("lists each form by its store id, with an ordinal for ids two forms share", async () => {
    form({ name: "" }, "signup");
    form({ name: "" }, "profile");
    form({ name: "" }, "profile");
    const root = await open();
    button(root, "Choose a form").click();
    await frame();
    const items = [...root.querySelectorAll('[role="menuitemradio"]')].map((item) => item.textContent);
    expect(items).toEqual(["signup", "profile #1", "profile #2"]);
  });

  it("moves to the corner picked in the menu and keeps it in localStorage", async () => {
    form({ name: "" });
    const root = await open();
    expect(root.querySelector(".dock")?.getAttribute("data-corner")).toBe("bottom-left");
    button(root, "Devtools menu").click();
    await frame();
    button(root, "Top right").click();
    await frame();
    expect(root.querySelector(".dock")?.getAttribute("data-corner")).toBe("top-right");
    expect(localStorage.getItem(cornerKey)).toBe("top-right");
  });

  it("leaves Turn off devtools out when the form has no onDisable", async () => {
    form({ name: "" });
    const root = await open();
    button(root, "Devtools menu").click();
    await frame();
    expect(root.textContent).toContain("Dock position");
    expect(root.textContent).not.toContain("Turn off devtools");
  });

  it("calls onDisable from Turn off devtools, which hides the panel", async () => {
    let on = true;
    const store = createFormsCore({ plugins: [devtools({ enabled: () => on, onDisable: () => (on = false) })] })
      .define({ defaultValues: { name: "" } })
      .createStore();
    cleanups.push(store.subscribeForm(() => {}));
    const root = await open();
    button(root, "Devtools menu").click();
    await frame();
    button(root, "Turn off devtools").click();
    expect(on).toBe(false);
    expect(hook().on).toBe(false);
    expect(document.querySelector("[data-lunarhue-forms-devtools]")).toBeNull();
  });

  it("outlines every form with its name on a tag, and the tag selects the form and opens the Fields tab", async () => {
    const store = form({ name: "" }, "signup");
    const element = document.createElement("form");
    document.body.prepend(element);
    // What an adapter's ref reports for the form element.
    tracking.record?.(element, store, true, "test");
    const root = await open();
    expect(root.querySelectorAll(".form-outline")).toHaveLength(1);
    expect(button(root, "Choose a form").textContent).toContain("No form");
    button(root, "Select form signup").click();
    await frame();
    expect(root.querySelector(".form-outline")?.classList.contains("on")).toBe(true);
    expect(button(root, "Form signup. Choose a form")).toBeDefined();
    expect(root.querySelector('[aria-label="Devtools fields"]')).not.toBeNull();
  });

  it("has no pick button", async () => {
    form({ name: "" });
    const root = await open();
    expect([...root.querySelectorAll("button")].some((element) => /pick/i.test(element.getAttribute("aria-label") ?? ""))).toBe(false);
  });

  it("shows the clear button in place of the chevron once a form is selected", async () => {
    form({ name: "" }, "signup");
    const root = await open();
    expect(root.querySelector(".chip-main svg")).not.toBeNull();
    button(root, "Fields").click();
    await frame();
    expect(root.querySelector(".chip-main svg")).toBeNull();
    button(root, "Clear selection signup").click();
    await frame();
    expect(root.querySelector(".chip-main svg")).not.toBeNull();
    expect(root.querySelector('[aria-label="Devtools fields"]')).toBeNull();
  });

  it("names a form whose id an adapter made up by its place on the page", async () => {
    form({ name: "" }, "_R_2_");
    form({ name: "" }, "signup");
    form({ name: "" }, ":r5:");
    const root = await open();
    button(root, "Choose a form").click();
    await frame();
    const items = [...root.querySelectorAll('[role="menuitemradio"]')].map((item) => item.textContent);
    expect(items).toEqual(["form 1", "signup", "form 3"]);
  });

  it("gives every icon-only button a tooltip", async () => {
    const store = form({ name: "", address: { city: "" } }, "signup");
    field(store, ["name"]);
    const root = await open();
    button(root, "Fields").click();
    await frame();
    const iconOnly = [...root.querySelectorAll("button")].filter((element) => element.textContent === "");
    expect(iconOnly.length).toBeGreaterThan(3);
    for (const element of iconOnly) expect(element.getAttribute("data-tip")).toBeTruthy();
  });
});

describe("Fields", () => {
  it("shows the root's children and follows writes on the next frame", async () => {
    const store = form({ name: "Ada", address: { city: "London" }, tags: ["a", "b"] });
    const root = await open();
    button(root, "Fields").click();
    await frame();
    expect(row(root, ["name"])?.textContent).toContain('"Ada"');
    expect(row(root, ["address"])?.textContent).toContain("1 field");
    expect(row(root, ["tags"])?.textContent).toContain("2 rows");
    expect(row(root, ["address", "city"])).toBeNull();
    store.root.at("name").setValue("Grace");
    await frame();
    expect(row(root, ["name"])?.textContent).toContain('"Grace"');
  });

  it("shows a write that lands after the tab renders but before its effects run", async () => {
    const store = form({ name: "Ada" });
    const root = await open();
    button(root, "Fields").click();
    // Preact renders on a microtask and runs effects a frame later.
    await Promise.resolve();
    await Promise.resolve();
    expect(row(root, ["name"])?.textContent).toContain('"Ada"');
    store.root.at("name").setValue("Grace");
    await frame();
    expect(row(root, ["name"])?.textContent).toContain('"Grace"');
  });

  it("walks into a row only once it is expanded, with array items by key", async () => {
    const store = form({ address: { city: "London" }, tags: ["a", "b"] });
    const root = await open();
    button(root, "Fields").click();
    await frame();
    button(root, "Expand address").click();
    button(root, "Expand tags").click();
    await frame();
    expect(row(root, ["address", "city"])?.textContent).toContain('"London"');
    const keys = store.getSnapshot(["tags"]).keys ?? [];
    expect(row(root, ["tags", keys[1] ?? ""])?.textContent).toContain('1 "b"');
  });

  it("shows flags as icons, with dirty only when the form has dirty()", async () => {
    const store = form({ name: "" });
    const root = await open();
    button(root, "Fields").click();
    await frame();
    store.root.at("name").setValue("x");
    store.root.at("name").setTouched(true);
    await frame();
    const flags = [...(row(root, ["name"])?.querySelectorAll(".flag") ?? [])].map((flag) => flag.getAttribute("aria-label"));
    expect(flags).toEqual(["edited: Changed by the user since the last reset", "touched: Blurred since the last reset"]);
  });

  it("shows a flag's detail in a hover card: the errors by source for invalid, the last write for edited", async () => {
    const store = form({ name: "", email: "" });
    const root = await open();
    button(root, "Fields").click();
    await frame();
    store.root.at("email").setValue("a@b");
    store.setErrors({ fields: { email: { message: "Taken." } } });
    await frame();
    row(root, ["email"])?.querySelector(".flag.invalid")?.dispatchEvent(new Event("pointerenter"));
    await frame();
    expect(root.querySelector(".hovercard")?.textContent).toBe("InvalidHas errorssetErrorsTaken.");
    row(root, ["email"])?.querySelector(".flag.invalid")?.dispatchEvent(new Event("pointerleave"));
    row(root, ["email"])?.querySelector(".flag.edited")?.dispatchEvent(new Event("pointerenter"));
    await frame();
    expect(root.querySelector(".hovercard")?.textContent).toContain('"""a@b"user');
  });

  it("filters by name into a flat list, and to the fields with errors", async () => {
    const store = form({ name: "", address: { city: "", zip: "" } });
    store.setErrors({ fields: { "address.zip": { message: "No." } } });
    const root = await open();
    button(root, "Fields").click();
    await frame();
    const box = root.querySelector<HTMLInputElement>('input[type="search"]');
    if (!box) throw new Error("No filter box.");
    box.value = "CI";
    box.dispatchEvent(new Event("input"));
    await frame();
    expect([...root.querySelectorAll("[data-path]")].map((item) => item.getAttribute("data-path"))).toEqual(['["address","city"]']);
    expect(row(root, ["address", "city"])?.textContent).toContain("address.city");
    box.value = "";
    box.dispatchEvent(new Event("input"));
    button(root, "Only fields with errors").click();
    await frame();
    expect([...root.querySelectorAll("[data-path]")].map((item) => item.getAttribute("data-path"))).toEqual(['["address","zip"]']);
    box.value = "name";
    box.dispatchEvent(new Event("input"));
    await frame();
    expect(root.textContent).toContain("No field has an error.");
  });

  it("shows the selected field's value, baseline and writes with their causes", async () => {
    const store = form({ name: "Ada" });
    const root = await open();
    button(root, "Fields").click();
    await frame();
    row(root, ["name"])?.querySelector<HTMLButtonElement>(".row-main")?.click();
    await frame();
    const detail = () => root.querySelector('[aria-label="Field detail"]')?.textContent ?? "";
    expect(detail()).toBe('namevalue"Ada"baseline"Ada"writesnone logged');
    store.root.at("name").setValue("Grace");
    store.root.at("name").setValue("Grace Hopper");
    await frame();
    expect(detail()).toBe('namevalue"Grace Hopper"baseline"Ada"writes"Grace""Grace Hopper"user"Ada""Grace"user');
  });
});

describe("Fields rows", () => {
  it("selects a field from anywhere on its row, its indent included, and not from its buttons", async () => {
    form({ address: { city: "" } });
    const root = await open();
    button(root, "Fields").click();
    await frame();
    button(root, "Expand address").click();
    await frame();
    const city = row(root, ["address", "city"]);
    city?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await frame();
    expect(row(root, ["address", "city"])?.getAttribute("aria-current")).toBe("true");
    button(root, "Collapse address").click();
    await frame();
    expect(row(root, ["address"])?.getAttribute("aria-current")).toBeNull();
  });

  it("keeps a slot for every flag, so a flag coming or going moves nothing", async () => {
    const store = form({ name: "" });
    field(store, ["name"]);
    const root = await open();
    button(root, "Fields").click();
    await frame();
    const slots = () => row(root, ["name"])?.lastElementChild?.children.length;
    const before = slots();
    store.root.at("name").setTouched(true);
    await frame();
    expect(root.querySelector(".flag.touched")).not.toBeNull();
    expect(slots()).toBe(before);
  });

  it("uses the styled tooltip, never a native title", async () => {
    const store = form({ name: "" });
    field(store, ["name"]);
    store.root.at("name").setValue("Ada");
    const root = await open();
    for (const tab of ["Fields", "Log", "Plugins", "Bundle"]) {
      button(root, tab).click();
      await frame();
      expect(root.querySelector("[title]")).toBeNull();
    }
  });
});

describe("Log", () => {
  it("lists writes and submissions newest first, with causes and aborted submissions marked", async () => {
    let finish: (() => void) | undefined;
    const store = createFormsCore({ plugins: [devtools()] })
      .define({
        defaultValues: { name: "", tags: ["a"] },
        onSubmit: () => new Promise<void>((resolve) => (finish = resolve)),
      })
      .createStore();
    cleanups.push(store.subscribeForm(() => {}));
    const root = await open();
    button(root, "Log").click();
    await frame();
    expect(root.textContent).toContain("No writes or submissions yet");
    store.root.at("name").setValue("Ada");
    void store.submit();
    await frame();
    store.reset();
    void store.submit();
    await frame();
    finish?.();
    await frame();
    const items = [...root.querySelectorAll(".log-item")].map((item) => item.textContent);
    expect(items[0]).toMatch(/^#\d+submit succeeded/);
    expect(items.find((item) => item?.includes("aborted"))).toContain("reset during submit");
    expect(items.find((item) => item?.includes("name"))).toContain('"" → "Ada"user');
    expect(items.some((item) => item?.includes("reset"))).toBe(true);
    const seqs = [...root.querySelectorAll(".log-item")].map((item) => Number(item.getAttribute("data-seq")));
    expect(seqs.every((seq, index) => index === 0 || seq < (seqs[index - 1] ?? 0))).toBe(true);
  });
});

describe("Plugins", () => {
  it("lists every installed plugin in hook order with its form meta and API keys", async () => {
    const counter = definePlugin({
      name: "counter",
      initialFormMeta: { count: 0 },
      setup: (ctx) => {
        ctx.setFormMeta({ count: 1 });
        return { api: { bump() {}, reset() {} } };
      },
    });
    const store = createFormsCore({ plugins: [counter, devtools()] })
      .define({ defaultValues: { name: "" } })
      .createStore();
    cleanups.push(store.subscribeForm(() => {}));
    const root = await open();
    button(root, "Plugins").click();
    await frame();
    const names = [...root.querySelectorAll(".plugin")].map((item) => item.getAttribute("data-plugin"));
    expect(names).toEqual(["counter", "devtools"]);
    const first = root.querySelector('[data-plugin="counter"]')?.textContent ?? "";
    expect(first).toContain('"count": 1');
    expect(first).toContain("bump, reset");
  });
});

/** An input on the page, recorded for the field at `path` the way an adapter's ref records it. */
function field(store: ReturnType<typeof form>, path: Path): HTMLInputElement {
  const element = document.createElement("input");
  document.body.prepend(element);
  const handle = store.fieldAt(path);
  if (!handle) throw new Error(`No field at ${JSON.stringify(path)}.`);
  tracking.record?.(element, handle, true, "test");
  return element;
}

const move = (target: Element, altKey = false) =>
  target.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, composed: true, altKey }));

const card = (root: ShadowRoot) => root.querySelector(".card");

describe("inspect", () => {
  it("offers inspecting only for forms whose adapter records elements", async () => {
    form({ name: "" });
    const root = await open();
    expect(root.querySelector('[aria-label="Inspect fields on the page"]')).toBeNull();
  });

  it("shows a card for the field under the pointer while the toggle is on", async () => {
    const store = form({ name: "Ada" });
    const input = field(store, ["name"]);
    const root = await open();
    move(input);
    await frame();
    expect(card(root)).toBeNull();
    button(root, "Inspect fields on the page").click();
    await frame();
    move(input);
    await frame();
    expect(card(root)?.getAttribute("aria-label")).toBe("Field name");
    expect(card(root)?.textContent).toContain('"Ada"');
    expect(root.querySelectorAll(".field-outline")).toHaveLength(1);
    store.root.at("name").setValue("Grace");
    await frame();
    expect(card(root)?.textContent).toContain('"Grace"');
    move(document.body);
    await frame();
    // The card stays a moment after the pointer leaves, for a pointer crossing a gap.
    expect(card(root)).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await frame();
    expect(card(root)).toBeNull();
  });

  it("shows the card while Alt is held, and drops it when Alt comes up", async () => {
    const store = form({ name: "Ada" });
    const input = field(store, ["name"]);
    const root = await open();
    move(input, true);
    await frame();
    expect(card(root)?.textContent).toContain('"Ada"');
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt" }));
    await frame();
    expect(card(root)).toBeNull();
  });

  it("pins the card on a click, which the page never gets, and selects the row with its parents expanded", async () => {
    const store = form({ name: "", address: { city: "London" } });
    const input = field(store, ["address", "city"]);
    let clicks = 0;
    input.addEventListener("click", () => clicks++);
    const root = await open();
    button(root, "Inspect fields on the page").click();
    await frame();
    move(input);
    input.click();
    await frame();
    expect(clicks).toBe(0);
    expect(card(root)?.querySelector('[aria-label="Unpin the field card"]')).not.toBeNull();
    expect(row(root, ["address", "city"])?.getAttribute("aria-current")).toBe("true");
    expect(root.querySelector('[aria-label="Field detail"] strong')?.textContent).toBe("address.city");
    button(root, "Unpin the field card").click();
    await frame();
    expect(card(root)).toBeNull();
  });

  it("keeps inspecting after a click, so the next click pins another field, until the toggle turns it off", async () => {
    const store = form({ name: "", email: "" });
    const name = field(store, ["name"]);
    const email = field(store, ["email"]);
    let clicks = 0;
    email.addEventListener("click", () => clicks++);
    const root = await open();
    const toggle = button(root, "Inspect fields on the page");
    toggle.click();
    await frame();
    name.click();
    await frame();
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    email.click();
    await frame();
    expect(clicks).toBe(0);
    expect(card(root)?.getAttribute("aria-label")).toBe("Field email");
    expect(row(root, ["email"])?.getAttribute("aria-current")).toBe("true");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await frame();
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    toggle.click();
    await frame();
    email.click();
    expect(clicks).toBe(1);
  });

  it("counts a label as its field: one that names the input with for, and one that wraps it", async () => {
    const store = form({ name: "Ada", email: "a@b.c" });
    const name = field(store, ["name"]);
    name.id = "name-input";
    const forLabel = document.createElement("label");
    forLabel.htmlFor = "name-input";
    forLabel.textContent = "Name";
    document.body.prepend(forLabel);
    const email = field(store, ["email"]);
    const wrapping = document.createElement("label");
    const text = document.createElement("span");
    text.textContent = "Email";
    wrapping.append(text);
    email.replaceWith(wrapping);
    wrapping.append(email);
    const root = await open();
    button(root, "Inspect fields on the page").click();
    await frame();
    move(forLabel);
    await frame();
    expect(card(root)?.getAttribute("aria-label")).toBe("Field name");
    move(text);
    await frame();
    expect(card(root)?.getAttribute("aria-label")).toBe("Field email");
  });

  it("scrolls a field's element into view from its row's show button", async () => {
    const store = form({ name: "" });
    const input = field(store, ["name"]);
    const scroll = vi.fn<(options?: ScrollIntoViewOptions) => void>();
    input.scrollIntoView = scroll;
    const root = await open();
    button(root, "Fields").click();
    await frame();
    button(root, "Show name on the page").click();
    expect(scroll).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
  });

  it("outlines a field's elements while the pointer is over its row", async () => {
    const store = form({ name: "" });
    field(store, ["name"]);
    field(store, ["name"]);
    const root = await open();
    button(root, "Fields").click();
    await frame();
    row(root, ["name"])?.dispatchEvent(new Event("pointerenter"));
    await frame();
    expect(root.querySelectorAll(".field-outline")).toHaveLength(2);
    row(root, ["name"])?.dispatchEvent(new Event("pointerleave"));
    await frame();
    expect(root.querySelectorAll(".field-outline")).toHaveLength(0);
  });
});

/** The global a bundler plugin defines as the size report's URL. */
const sizesKey = "__LUNARHUE_FORMS_SIZES__";

/** The size the Bundle tab shows for a part, by its `kind:name`: in kB in the graph, in bytes in the run order. */
const sizeOf = (root: ShadowRoot, part: string) => root.querySelector(`[data-part="${part}"] .num`)?.textContent;

describe("Bundle", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, sizesKey);
    vi.unstubAllGlobals();
  });

  const third = definePlugin({ name: "thirdParty", setup: () => ({}) });

  /** A form with a third-party plugin, and an element recorded so the adapter is known. */
  function tracked() {
    const store = createFormsCore({ plugins: [third, devtools()] }).define({ defaultValues: { name: "" } }).createStore();
    cleanups.push(store.subscribeForm(() => {}));
    const element = document.createElement("form");
    document.body.prepend(element);
    tracking.record?.(element, store, true, "test");
    return store;
  }

  it("shows core, the adapter and every plugin with no sizes until a bundler plugin measures the build", async () => {
    tracked();
    const root = await open();
    button(root, "Bundle").click();
    await frame();
    const parts = [...root.querySelectorAll("[data-part]")].map((item) => item.getAttribute("data-part"));
    expect(parts).toEqual(["core:@lunarhue/forms-core", "adapter:test", "plugin:thirdParty", "devtools:devtools"]);
    expect(sizeOf(root, "core:@lunarhue/forms-core")).toBe("–");
    expect(root.querySelector(".note")?.textContent).toContain("@lunarhue/forms-devtools/vite");
  });

  it("fetches the report once from the defined URL and joins its parts by kind and name", async () => {
    const report: SizeReport = {
      version: 1,
      bundler: "vite",
      builtAt: "2026-11-20T10:00:00.000Z",
      total: { minified: 182_400, gzip: 61_200 },
      parts: [
        { kind: "core", name: "@lunarhue/forms-core", minified: 21_340, chunks: ["assets/index.js"] },
        { kind: "adapter", name: "test", minified: 6100, chunks: ["assets/index.js"] },
        { kind: "plugin", name: "thirdParty", minified: 840, chunks: ["assets/index.js"] },
      ],
    };
    const fetch = vi.fn<() => Promise<unknown>>(async () => ({ ok: true, status: 200, json: async () => report }));
    vi.stubGlobal("fetch", fetch);
    Reflect.set(globalThis, sizesKey, "/sizes-joined.json");
    tracked();
    const root = await open();
    expect(fetch).not.toHaveBeenCalled();
    button(root, "Bundle").click();
    await frame();
    await frame();
    expect(fetch).toHaveBeenCalledWith("/sizes-joined.json");
    expect(root.querySelector(".note")?.textContent).toContain("measured, from the build at");
    expect(sizeOf(root, "core:@lunarhue/forms-core")).toBe("21.3");
    expect(sizeOf(root, "adapter:test")).toBe("6.1");
    expect(sizeOf(root, "plugin:thirdParty")).toBe("840 B");
    // The report has no devtools part, which a production build leaves out.
    expect(sizeOf(root, "devtools:devtools")).toBe("dev only");
    // The graph's top bar is what the forms packages add up to.
    expect(root.querySelector(".bar-part .num")?.textContent).toBe("28.3");
    expect(root.querySelector(".graph-head")?.textContent).toContain("182.40 kB");
    button(root, "Fields").click();
    await frame();
    button(root, "Bundle").click();
    await frame();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("says when the report can't be read", async () => {
    vi.stubGlobal("fetch", vi.fn<() => Promise<unknown>>(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    Reflect.set(globalThis, sizesKey, "/sizes-missing.json");
    tracked();
    const root = await open();
    button(root, "Bundle").click();
    await frame();
    await frame();
    expect(root.querySelector(".note.error")?.textContent).toContain("HTTP 404");
    expect(sizeOf(root, "core:@lunarhue/forms-core")).toBe("–");
  });
});

describe("listeners", () => {
  it("never subscribes to the store, so other plugins' onActive still ends", async () => {
    let active = 0;
    const probe = definePlugin({
      name: "probe",
      setup: () => ({
        onActive() {
          active++;
          return () => {
            active--;
          };
        },
      }),
    });
    const store = createFormsCore({ plugins: [devtools(), probe] })
      .define({ defaultValues: { name: "", address: { city: "" } } })
      .createStore();
    const off = store.subscribeForm(() => {});
    expect(active).toBe(1);
    // The panel goes when the last form leaves, so a second form keeps it open.
    form({ other: "" });
    const root = await open();
    button(root, "Fields").click();
    await frame();
    button(root, "Expand address").click();
    await frame();
    row(root, ["name"])?.querySelector<HTMLButtonElement>(".row-main")?.click();
    await frame();
    button(root, "Log").click();
    await frame();
    button(root, "Plugins").click();
    await frame();
    off();
    expect(active).toBe(0);
  });
});
