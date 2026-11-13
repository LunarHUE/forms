import type { PluginContext } from "@lunarhue/forms-core";
import { definePlugin } from "@lunarhue/forms-core/plugins";
import { type Rebase, rebase } from "@lunarhue/forms-core/plugins/rebase";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createForm, createForms, type FormOf } from "../index.js";
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
