import type { PluginContext } from "@lunarhue/forms-core";
import { definePlugin } from "@lunarhue/forms-core/plugins";
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
