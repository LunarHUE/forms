import { definePlugin } from "@lunarhue/forms-core/plugins";
import { describe, expect, it } from "vitest";
import { createForm, createForms } from "../index.js";
import { get, getAs, mount, settle, typeText } from "./dom.js";

declare module "@lunarhue/forms-core" {
  interface FieldMeta {
    readonly chars: number;
  }
  interface FormMeta {
    readonly writes: number;
  }
}

// Shared: stores each written string's length as the field's meta.
const chars = definePlugin({
  name: "chars",
  setup: (ctx) => ({
    onWrite(records) {
      for (const record of records) if (record.type === "value") ctx.setMeta(record.path, String(record.after).length);
    },
  }),
});

// The definition's own: upper-cases every value and counts the writes on the form.
const upper = definePlugin({
  name: "writes",
  setup(ctx) {
    let writes = 0;
    return {
      beforeWrite: (write) => (typeof write.value === "string" ? write.value.toUpperCase() : write.value),
      onWrite: () => ctx.setFormMeta(++writes),
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
          <output>{field.meta?.chars ?? "none"}</output>
          <p>{form.state.meta?.writes ?? 0}</p>
        </>
      )}
    </form.Field>
  );
}

describe("plugins", () => {
  it("run when installed through createForms and define, and their meta reaches the field and form state", async () => {
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
