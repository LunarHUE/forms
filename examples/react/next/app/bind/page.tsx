"use client";
import { zustand } from "@lunarhue/forms-bind/zustand";
import { Inspector } from "@lunarhue/forms-example-react";
import {
  createForms,
  type FieldApi,
  type HandleOf,
  useForm,
  useFormContext,
  useFormState,
} from "@lunarhue/forms-react";
import { dirty } from "@lunarhue/forms-react/plugins/dirty";
import { rebase } from "@lunarhue/forms-react/plugins/rebase";
import { zod } from "@lunarhue/forms-schema/zod";
import { z } from "zod";
import { create } from "zustand";

// The root README's example, running. The form keeps its own state:
// values, errors, touched flags and the rest. The binding only copies the
// value between the form and a zustand store, both ways.

// Your own input, registered once.
interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function TextField({ field, label }: TextFieldProps) {
  const empty = field.shownErrors.length === 0;
  return (
    <div className="field">
      <label className="field-label" htmlFor={field.id}>
        {label}
      </label>
      <input {...field.inputProps()} />
      <ul
        className="field-errors"
        id={field.errorId}
        aria-hidden={empty ? true : undefined}
      >
        {field.shownErrors.map((error) => (
          <li key={error.message}>{error.message}</li>
        ))}
      </ul>
    </div>
  );
}

// One plugin list. Zod brings validation.
// Rebase merges fresh server data.
// Dirty gives the inspector its dirty flags.
const forms = createForms({
  plugins: [zod(), rebase(), dirty()],
  fields: { TextField },
});

const Address = z.object({
  street: z.string().min(1, "Enter a street."),
  city: z.string().min(1, "Enter a city."),
});

const Profile = z.object({
  name: z.string().min(1, "Enter your name."),
  email: z.email("Enter a valid email."),
  address: Address,
});

type Profile = z.infer<typeof Profile>;

// A store your app already has. The form does not live in it. The
// binding below copies values both ways, and starts the form from the
// store's state, on the server too.
const useProfileStore = create<Profile>()(() => ({
  name: "Ada Lovelace",
  email: "ada@example.com",
  address: { street: "12 St James's Square", city: "London" },
}));

// A stand-in for the server: a save, and a fresh copy that someone else
// changed in the meantime.
const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const saveProfile = async (value: Profile) => {
  await wait(300);
  return `Saved ${value.name}.`;
};

const loadProfile = async (): Promise<Profile> => {
  await wait(300);
  return {
    name: "Augusta Ada King",
    email: "ada.king@example.com",
    address: { street: "Horsley Towers", city: "East Horsley" },
  };
};

// The binding goes in the definition, so every form made from `profile`
// shares this one store. When each mounted form needs a store of its
// own, such as one a component makes, give the binding to that form
// alone: `useForm(profile, { plugins: [zustand(store)] })`. That list
// also checks the store's type against the form's value.
const profile = forms.define({
  schema: Profile,
  plugins: [zustand(useProfileStore)],
  onSubmit: saveProfile,
});

// A reusable group of fields,
// usable under any form with an address.
const AddressFieldset = forms.fieldset(Address);

interface AddressFieldsProps {
  readonly field: HandleOf<typeof AddressFieldset>;
}

function AddressFields({ field }: AddressFieldsProps) {
  const scope = AddressFieldset.scope(field);
  return (
    <fieldset className="fieldset">
      <legend>Address</legend>
      <scope.TextField name="street" label="Street" />
      <scope.TextField name="city" label="City" />
    </fieldset>
  );
}

// Works under any form, from any `createForms` call, so it uses the
// untyped `useFormContext()`. It only reads the form state.
function SubmitButton() {
  const form = useFormContext();
  const submitting = useFormState(
    form,
    (state) => state.submitting,
  );
  return (
    <button
      type="submit"
      className="button button-primary"
      disabled={submitting}
    >
      {submitting ? "Saving..." : "Save"}
    </button>
  );
}

// The store as zustand sees it, and a change made outside the form.
// Other parts of the app read and write the store the usual zustand
// way and never need to know a form is bound to it.
function StorePanel() {
  const state = useProfileStore((current) => current);
  const change = () =>
    useProfileStore.setState({
      name: "Grace Hopper",
      email: "grace@example.com",
    });
  return (
    <section className="fieldset" aria-label="Store">
      <h2>Zustand store</h2>
      <pre data-testid="store">{JSON.stringify(state, null, 2)}</pre>
      <button type="button" className="button" onClick={change}>
        Change the store
      </button>
    </section>
  );
}

export default function ProfilePage() {
  const form = useForm(profile);

  // Take the server's copy,
  // but keep whatever the user has typed.
  const refresh = async () => {
    const fresh = await loadProfile();
    form.plugins.rebase(form.root, fresh, (leaf) =>
      leaf.edited ? "keep" : "take",
    );
  };

  return (
    <main className="page">
      <section className="page-form">
        <form.Form>
          {(formProps) => (
            <form
              {...formProps}
              className="order-form"
              aria-label="Profile"
            >
              <form.TextField name="name" label="Name" />
              <form.TextField name="email" label="Email" />
              <AddressFields field={form.root.at("address")} />
              <div className="form-actions">
                <SubmitButton />
                <button
                  type="button"
                  className="button"
                  onClick={() => void refresh()}
                >
                  Refresh
                </button>
                <form.State select={(state) => state.submission}>
                  {(submission) => (
                    <span className="form-status" role="status">
                      {submission.status === "succeeded"
                        ? submission.result
                        : null}
                    </span>
                  )}
                </form.State>
              </div>
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
