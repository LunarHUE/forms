import { createFormsCore, type Path } from "@lunarhue/forms-core";
import { definePlugin } from "@lunarhue/forms-core/plugins";
import { afterEach, describe, expect, it } from "vitest";
import { cornerKey } from "./panel/corner.js";
import { type Hook, hookKey } from "./hook.js";
import { devtools } from "./index.js";
import { mount } from "./panel.js";

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

  it("selects a form from its outline in pick mode and opens the Fields tab", async () => {
    const store = form({ name: "" }, "signup");
    const element = document.createElement("form");
    document.body.prepend(element);
    // What an adapter's ref reports for the form element.
    const { tracking } = await import("@lunarhue/forms-core");
    tracking.record?.(element, store, true, "test");
    const root = await open();
    button(root, "Pick a form on the page").click();
    await frame();
    button(root, "Pick form signup").click();
    await frame();
    expect(root.querySelector(".outline")).toBeNull();
    expect(button(root, "Form signup. Choose a form")).toBeDefined();
    expect(root.querySelector('[aria-label="Devtools fields"]')).not.toBeNull();
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

  it("shows flags, with dirty only when the form has dirty()", async () => {
    const store = form({ name: "" });
    const root = await open();
    button(root, "Fields").click();
    await frame();
    store.root.at("name").setValue("x");
    store.root.at("name").setTouched(true);
    await frame();
    expect(row(root, ["name"])?.querySelector(".flags")?.textContent).not.toContain("dirty");
    expect(row(root, ["name"])?.querySelector(".flags")?.textContent).toContain("edited");
  });

  it("filters to invalid fields and shows the selected field's errors by source", async () => {
    const store = form({ name: "", email: "" });
    store.setErrors({ fields: { email: { message: "Taken." } } });
    const root = await open();
    button(root, "Fields").click();
    await frame();
    const filter = root.querySelector<HTMLInputElement>('input[type="checkbox"]');
    filter?.click();
    await frame();
    expect(row(root, ["name"])).toBeNull();
    expect(row(root, ["email"])?.textContent).toContain("Taken.");
    row(root, ["email"])?.querySelector<HTMLButtonElement>(".row-main")?.click();
    await frame();
    const detail = root.querySelector('[aria-label="Field detail"]');
    expect(detail?.textContent).toContain("setErrors Taken.");
    expect(detail?.textContent).toContain('["email"]');
  });

  it("shows the last write with its cause and the baseline", async () => {
    const store = form({ name: "Ada" });
    const root = await open();
    button(root, "Fields").click();
    await frame();
    row(root, ["name"])?.querySelector<HTMLButtonElement>(".row-main")?.click();
    await frame();
    expect(root.querySelector('[aria-label="Field detail"]')?.textContent).toContain("same as value");
    store.root.at("name").setValue("Grace");
    await frame();
    const detail = root.querySelector('[aria-label="Field detail"]')?.textContent ?? "";
    expect(detail).toContain("value by user");
    expect(detail).toContain('"Ada" → "Grace"');
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
    button(root, "Pick a form on the page").click();
    await frame();
    off();
    expect(active).toBe(0);
  });
});
