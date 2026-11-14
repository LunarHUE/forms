import type { PluginContext } from "@lunarhue/forms-core";
import { definePlugin, refuse } from "../plugins.js";
import { baselineOnSubmit, dirty } from "../plugins/dirty.js";
import { history } from "../plugins/history.js";
import { mask, upper as upperCase } from "../plugins/mask.js";
import { type Rebase, rebase } from "../plugins/rebase.js";
import { flush } from "solid-js";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createField, createForm, createForms, type FormOf } from "../index.js";
import { get, getAs, mount, settle, typeText } from "./dom.js";

// Shared: stores each written string's length as the field's meta.
const chars = definePlugin({
  name: "chars",
  setup: (ctx: PluginContext<number>) => ({
    onWrite(records) {
      for (const record of records) if (record.type === "value") ctx.setMeta(record.path, String(record.after).length);
    },
  }),
});

// The definition's own: upper-cases every value and counts the writes on the form.
const upper = definePlugin({
  name: "writes",
  setup(ctx: PluginContext<never, number>) {
    let writes = 0;
    return {
      beforeWrite: (write) => (typeof write.value === "string" ? write.value.toUpperCase() : write.value),
      onWrite: () => ctx.setFormMeta(++writes),
      api: { count: () => writes },
    };
  },
});

const forms = createForms({ plugins: [chars] });
const Profile = forms.define({ defaultValues: { name: "" }, plugins: [upper] });

function Name() {
  const form = createForm(Profile);
  return (
    <form.Field name="name">
      {(field) => (
        <>
          <input {...field.inputProps()} />
          <output>{chars.meta(field) ?? "none"}</output>
          <p>{upper.formMeta(form.state) ?? 0}</p>
          <button type="button" onClick={() => form.plugins.writes.count()}>
            count
          </button>
        </>
      )}
    </form.Field>
  );
}

describe("plugins", () => {
  it("run when installed through createForms and define, and their meta reaches the field and form state", async () => {
    expectTypeOf<FormOf<typeof Profile>["plugins"]>().toEqualTypeOf<{ readonly writes: { count: () => number } }>();
    const { host } = mount(() => <Name />);
    const input = get(host, "input");
    const output = getAs(host, "output", HTMLOutputElement);
    const writes = getAs(host, "p", HTMLParagraphElement);
    // The field object was made before any meta existed.
    expect(output.textContent).toBe("none");
    expect(writes.textContent).toBe("0");

    typeText(input, "ada");
    await settle();
    expect(input.value).toBe("ADA");
    expect(output.textContent).toBe("3");
    expect(writes.textContent).toBe("1");
  });
});

const Order = createForms({ plugins: [rebase()] }).define({ defaultValues: { name: "a", qty: 1 } });

interface OrderPageProps {
  readonly fresh: { readonly name: string; readonly qty: number };
}

function OrderPage({ fresh }: OrderPageProps) {
  const form = createForm(Order);
  return (
    <>
      <form.Field name="name">{(field) => <output>{field.value}</output>}</form.Field>
      <form.Field name="qty">{(field) => <p>{String(field.value)}</p>}</form.Field>
      <button type="button" onClick={() => form.plugins.rebase(form.root, fresh, (leaf) => (leaf.edited ? "keep" : "take"))}>
        reload
      </button>
    </>
  );
}

describe("the rebase plugin", () => {
  it("rebases the form through form.plugins.rebase", async () => {
    expectTypeOf<FormOf<typeof Order>["plugins"]>().toEqualTypeOf<{ readonly rebase: Rebase }>();
    const { host } = mount(() => <OrderPage fresh={{ name: "b", qty: 2 }} />);
    getAs(host, "button", HTMLButtonElement).click();
    await settle();
    expect(getAs(host, "output", HTMLOutputElement).textContent).toBe("b");
    expect(getAs(host, "p", HTMLParagraphElement).textContent).toBe("2");
  });
});

const undoHistory = history();
const Note = createForms({ plugins: [undoHistory] }).define({ defaultValues: { text: "" } });

function NotePage() {
  const form = createForm(Note);
  return (
    <>
      <form.Field name="text">{(field) => <input {...field.inputProps()} />}</form.Field>
      <button type="button" disabled={!undoHistory.formMeta(form.state).canUndo} onClick={() => form.plugins.history.undo()}>
        Undo
      </button>
    </>
  );
}

describe("the history plugin", () => {
  it("enables an undo button through its form meta and disables it after the undo", async () => {
    const { host } = mount(() => <NotePage />);
    const input = get(host, "input");
    const button = getAs(host, "button", HTMLButtonElement);
    expect(button.disabled).toBe(true);

    typeText(input, "a");
    // The step is recorded a microtask after the write.
    await settle();
    expect(button.disabled).toBe(false);

    button.click();
    await settle();
    expect(input.value).toBe("");
    expect(button.disabled).toBe(true);
  });
});

const Lines = createForms({ plugins: [dirty()] }).define({
  defaultValues: { lines: [{ sku: "ab-1" }] },
  plugins: [mask({ "lines.*.sku": upperCase })],
});

function LinesPage() {
  const form = createForm(Lines);
  return (
    <>
      <form.Items name="lines">
        {(row) => <form.Field handle={row.at("sku")}>{(field) => <input {...field.inputProps()} />}</form.Field>}
      </form.Items>
      <button type="button" onClick={() => form.root.at("lines").push({ sku: "cd-2" })}>
        add
      </button>
      <button type="button" onClick={() => form.root.reset()}>
        reset
      </button>
      <output>{form.state.dirty ? "dirty" : "clean"}</output>
    </>
  );
}

describe("mask through the adapter", () => {
  it("cleans the starting rows and a pushed row, and a reset leaves the form clean", () => {
    const { host } = mount(() => <LinesPage />);
    const skus = () => [...host.querySelectorAll("input")].map((input) => input.value);
    expect(skus()).toEqual(["AB-1"]);
    expect(getAs(host, "output", HTMLOutputElement).textContent).toBe("clean");
    const [add, reset] = host.querySelectorAll("button");
    add?.click();
    flush();
    expect(skus()).toEqual(["AB-1", "CD-2"]);
    expect(getAs(host, "output", HTMLOutputElement).textContent).toBe("dirty");
    reset?.click();
    flush();
    expect(skus()).toEqual(["AB-1"]);
    expect(getAs(host, "output", HTMLOutputElement).textContent).toBe("clean");
  });
});

const Settings = createForms({ plugins: [dirty()] }).define({
  defaultValues: { name: "" },
  plugins: [baselineOnSubmit()],
  onSubmit: async () => "saved",
});

function SettingsPage() {
  const form = createForm(Settings);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Field name="name">{(field) => <input {...field.inputProps()} />}</form.Field>
          <button type="submit" disabled={!form.state.dirty}>
            Save
          </button>
        </form>
      )}
    </form.Form>
  );
}

describe("baselineOnSubmit through the adapter", () => {
  it("disables the save button again after a successful save", async () => {
    const { host } = mount(() => <SettingsPage />);
    const button = getAs(host, "button", HTMLButtonElement);
    typeText(get(host, "input"), "Ada");
    flush();
    expect(button.disabled).toBe(false);
    getAs(host, "form", HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    flush();
    expect(get(host, "input").value).toBe("Ada");
    expect(button.disabled).toBe(true);
  });
});

/** Refuses every submit after failing to get a captcha token, with a form error that says why. */
const captcha = definePlugin({
  name: "captcha",
  setup: (ctx) => ({
    async onSubmit() {
      await Promise.resolve();
      ctx.store.root.setErrors({ message: "No token" });
      return refuse;
    },
  }),
});

describe("a plugin that refuses a submit through the adapter", () => {
  it("ends the submit invalid, skips onSubmit and shows the plugin's form error", async () => {
    const onSubmit = vi.fn<() => void>();
    const Checked = createForms().define({ defaultValues: { name: "Ada" }, plugins: [captcha], onSubmit });
    const { host } = mount(() => {
      const form = createForm(Checked);
      const root = createField(form.root);
      return (
        <form.Form>
          {(props) => (
            <form {...props}>
              <p>{root.shownErrors.map((error) => error.message).join()}</p>
              <output>{form.state.submission.status}</output>
            </form>
          )}
        </form.Form>
      );
    });
    getAs(host, "form", HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    flush();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(getAs(host, "output", HTMLOutputElement).textContent).toBe("invalid");
    expect(getAs(host, "p", HTMLParagraphElement).textContent).toBe("No token");
  });
});
