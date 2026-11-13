"use client";
import { Inspector } from "@lunarhue/forms-example-react";
import { zustand } from "@lunarhue/forms-bind/zustand";
import { createForms, type FieldApi, useForm } from "@lunarhue/forms-react";
import { create } from "zustand";

interface Profile {
  name: string;
  email: string;
}

// 1. A zustand store the app owns. Other parts of the app read and write it
// the usual zustand way and never need to know a form is bound to it.
const useProfileStore = create<Profile>()(() => ({ name: "Ada Lovelace", email: "ada@example.com" }));

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function TextField({ field, label }: TextFieldProps) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={field.id}>
        {label}
      </label>
      <input {...field.inputProps()} />
    </div>
  );
}

// 2. The definition. The binding starts the form from the store's state, on
// the server too, so these defaults only give the form its value type.
const forms = createForms({ fields: { TextField } });
const profile = forms.define<Profile>({ defaultValues: { name: "", email: "" } });

// 3. The store's state as zustand sees it, and a change made outside the form.
function StorePanel() {
  const state = useProfileStore((current) => current);
  return (
    <section className="fieldset" aria-label="Store">
      <h2>Zustand store</h2>
      <pre>{JSON.stringify(state, null, 2)}</pre>
      <button
        type="button"
        className="button"
        onClick={() => useProfileStore.setState({ name: "Grace Hopper", email: "grace@example.com" })}
      >
        Change the store
      </button>
    </section>
  );
}

// 4. The page. The binding goes in this form's own plugins, so another form
// from the same definition could bind another store. The form keeps its own
// state: only the value is copied, both ways. Typing writes the store, and
// the button's change shows up in the inputs.
export default function BindPage() {
  const form = useForm(profile, { plugins: [zustand(useProfileStore)] });
  return (
    <main className="page">
      <section className="page-form">
        <form.Form>
          {(formProps) => (
            <form {...formProps} className="order-form" aria-label="Profile">
              <form.TextField name="name" label="Name" />
              <form.TextField name="email" label="Email" />
            </form>
          )}
        </form.Form>
        <StorePanel />
      </section>
      {/* The example's dev panel, not part of the library. */}
      <aside className="page-inspector">
        <Inspector store={form.store} />
      </aside>
    </main>
  );
}
