import type { PluginContext } from "@lunarhue/forms-core";
import { definePlugin } from "@lunarhue/forms-core/plugins";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createForms, type FieldApi, type FormOf, useForm, useFormState } from "./index.js";

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

function TextField(props: { readonly field: FieldApi<string> }) {
  const { field } = props;
  return (
    <>
      <input aria-label="name" {...field.inputProps()} />
      <output>{chars.meta(field) ?? "none"}</output>
    </>
  );
}

const forms = createForms({ plugins: [chars], fields: { TextField } });
const profile = forms.define({ defaultValues: { name: "" }, plugins: [upper] });

function Profile() {
  const form = useForm(profile);
  const writes = useFormState(form, (snapshot) => upper.formMeta(snapshot) ?? 0);
  return (
    <>
      <form.TextField name="name" />
      <p>{writes}</p>
      <button type="button" onClick={() => form.plugins.writes.count()}>
        count
      </button>
    </>
  );
}

describe("plugins", () => {
  it("run when installed through createForms and define, and their meta reaches the field object and form state", () => {
    expectTypeOf<FormOf<typeof profile>["plugins"]>().toEqualTypeOf<{ readonly writes: { count: () => number } }>();
    const { container } = render(<Profile />);
    const output = container.querySelector("output");
    const writes = container.querySelector("p");
    expect(output?.textContent).toBe("none");
    expect(writes?.textContent).toBe("0");

    fireEvent.change(screen.getByLabelText("name"), { target: { value: "ada" } });
    expect(screen.getByLabelText<HTMLInputElement>("name").value).toBe("ADA");
    expect(output?.textContent).toBe("3");
    expect(writes?.textContent).toBe("1");
  });
});
