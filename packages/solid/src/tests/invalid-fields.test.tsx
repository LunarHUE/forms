import { For } from "solid-js";
import { describe, expect, it } from "vitest";
import { createForm, createForms, createInvalidFields, type FieldApi, type FormOf, inputProps } from "../index.js";
import { get, mount, settle, typeText } from "./dom.js";

function TextField(props: { field: FieldApi<string>; label: string }) {
  return (
    <label>
      {props.label}
      <input {...inputProps(props.field)} />
    </label>
  );
}

const forms = createForms({ fields: { TextField } });
const Account = forms.define({ defaultValues: { name: "", email: "" } });

/** Mounts the form with an error summary above its fields. */
function mountAccount() {
  let form: FormOf<typeof Account> | undefined;
  const { host } = mount(() => {
    form = createForm(Account);
    const f = form;
    const invalid = createInvalidFields(f);
    return (
      <f.Form>
        {(props) => (
          <form {...props}>
            <ul>
              <For each={invalid()}>{(entry) => <li class="summary">{`${entry.name}: ${entry.errors[0]?.message ?? ""}`}</li>}</For>
            </ul>
            <f.TextField name="name" label="Name" />
            <f.TextField name="email" label="Email" />
          </form>
        )}
      </f.Form>
    );
  });
  if (!form) throw new Error("The form was not created.");
  return { form, host };
}

const summary = (host: HTMLElement) => [...host.querySelectorAll(".summary")].map((item) => item.textContent);

describe("createInvalidFields", () => {
  it("lists errors from setErrors and drops a field once its edit clears them", async () => {
    const { form, host } = mountAccount();
    expect(summary(host)).toEqual([]);
    form.store.setErrors({ fields: { email: { message: "Taken" }, name: { message: "Too short" } } });
    await settle();
    expect(summary(host)).toEqual(["name: Too short", "email: Taken"]);
    typeText(get(host, "input[name=email]"), "ada@example.com");
    await settle();
    expect(summary(host)).toEqual(["name: Too short"]);
  });
});
