import type { FormStore } from "@lunarhue/forms-core";
import { render } from "@solidjs/web";
import { flush, type Element as SolidElement } from "solid-js";
import { afterEach, beforeEach, vi } from "vitest";

/** Each mounted tree, disposed after the test. */
const mounted: (() => void)[] = [];

/** Console warnings and errors during a test. Solid reports its dev diagnostics there. */
let reports: unknown[][] = [];

beforeEach(() => {
  reports = [];
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => void reports.push(args));
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => void reports.push(args));
});

afterEach(() => {
  for (const dispose of mounted.splice(0)) dispose();
  vi.restoreAllMocks();
  if (reports.length > 0) throw new Error(`Console reports during the test:\n${reports.map((args) => args.map(String).join(" ")).join("\n")}`);
});

/** Renders `ui` into a fresh element in the document and applies it. */
export function mount(ui: () => SolidElement): { readonly host: HTMLElement; readonly dispose: () => void } {
  const host = document.createElement("div");
  document.body.append(host);
  const disposeRender = render(ui, host);
  flush();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    disposeRender();
    host.remove();
  };
  mounted.push(dispose);
  return { host, dispose };
}

/** Lets Solid apply queued writes: the microtask it would wait for, then a flush. */
export async function settle(): Promise<void> {
  await Promise.resolve();
  flush();
}

/** Returns the element of type `type` matching `selector` in `host`, or fails the test. */
export function getAs<T extends Element>(host: ParentNode, selector: string, type: abstract new () => T): T {
  const element = host.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`No ${type.name} matches ${selector}.`);
  return element;
}

/** Returns the input matching `selector` in `host`, or fails the test. */
export function get(host: ParentNode, selector: string): HTMLInputElement {
  return getAs(host, selector, HTMLInputElement);
}

/** Types into a text control as a browser does: the DOM changes first, then `input` fires. */
export function typeText(element: HTMLInputElement | HTMLTextAreaElement, value: string, caret = value.length): void {
  element.value = value;
  // Number and email inputs have no selection.
  if (element.selectionStart !== null) element.setSelectionRange(caret, caret);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Clicks a checkbox or radio button: the browser flips `checked`, then `change` fires. */
export function click(element: HTMLInputElement): void {
  element.click();
}

/** Picks an option of a select and fires `change`. */
export function choose(element: HTMLSelectElement, value: string): void {
  element.value = value;
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Counts the store's live subscriptions by wrapping `subscribe` and `subscribeForm`. */
export function countSubscriptions(store: Pick<FormStore<unknown, unknown>, "subscribe" | "subscribeForm">): { readonly fields: number; readonly form: number } {
  const live = { fields: 0, form: 0 };
  const wrap = (kind: "fields" | "form", subscribe: () => () => void) => {
    live[kind]++;
    const unsubscribe = subscribe();
    let done = false;
    return () => {
      if (!done) live[kind]--;
      done = true;
      unsubscribe();
    };
  };
  const { subscribe, subscribeForm } = store;
  Object.assign(store, {
    subscribe: (path: Parameters<typeof subscribe>[0], listener: () => void) => wrap("fields", () => subscribe(path, listener)),
    subscribeForm: (listener: () => void) => wrap("form", () => subscribeForm(listener)),
  });
  return live;
}
