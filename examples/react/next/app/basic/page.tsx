"use client";
import { Inspector } from "@lunarhue/forms-example-react";
import { createForms, type FieldApi, type HandleOf, useFormState } from "@lunarhue/forms-react";
import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";

// 1. The schema. It validates the form and gives it its types: two text
// fields, a number, a checkbox, a nested address and a list of team members.
const AddressSchema = v.object({
  street: v.pipe(v.string(), v.nonEmpty("Enter a street.")),
  city: v.pipe(v.string(), v.nonEmpty("Enter a city.")),
});

const SignUpSchema = v.object({
  name: v.pipe(v.string(), v.nonEmpty("Enter your name.")),
  email: v.pipe(v.string(), v.email("Enter a valid email.")),
  age: v.pipe(v.number("Enter your age."), v.integer("Use a whole number."), v.minValue(18, "You must be 18 or over.")),
  newsletter: v.boolean(),
  address: AddressSchema,
  team: v.array(v.object({ name: v.pipe(v.string(), v.nonEmpty("Enter a name.")) })),
});


interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string
}
// 2. Field components. Each is a plain component with a `field` prop. The
// input props carry the value, change and blur handlers, and an
// `aria-describedby` that points at `field.errorId` while errors show. The
// error list is always rendered, so the stylesheet can keep a line of space
// for it, and is hidden from screen readers while it is empty.
function TextField({ field, label }: TextFieldProps) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={field.id}>
        {label}
      </label>
      <input {...field.inputProps()} />
      <ul className="field-errors" id={field.errorId} aria-hidden={field.shownErrors.length === 0 ? true : undefined}>
        {field.shownErrors.map((error) => (
          <li key={error.message}>{error.message}</li>
        ))}
      </ul>
    </div>
  );
}

interface NumberFieldProps {
  readonly field: FieldApi<number>;
  readonly label: string
}
// `FieldApi<number>` holds `number | undefined`, since a number field is
// empty until the user fills it in.
function NumberField({ field, label }: NumberFieldProps) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={field.id}>
        {label}
      </label>
      <input {...field.inputProps({ kind: "number" })} />
      <ul className="field-errors" id={field.errorId} aria-hidden={field.shownErrors.length === 0 ? true : undefined}>
        {field.shownErrors.map((error) => (
          <li key={error.message}>{error.message}</li>
        ))}
      </ul>
    </div>
  );
}

// 3. One `createForms` call for the app, then one definition per form.
// Registering the field components puts them on every form, so a form has
// `form.TextField` and `form.NumberField`. What `onSubmit` returns becomes
// the submit's result.
const forms = createForms({ schemas: [valibot()], fields: { TextField, NumberField } });

const signUp = forms.define({
  schema: SignUpSchema,
  defaultValues: {
    name: "Ada Lovelace",
    email: "ada@example.com",
    age: 36,
    address: { street: "12 St James's Square", city: "London" },
    team: [{ name: "Charles Babbage" }],
  },
  onSubmit: async (value) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return `Signed up ${value.name} with a team of ${value.team.length}.`;
  },

});

// 4. A reusable group. `fieldset` makes a shape from part of the schema, and
// `scope` binds the field components to the handle it is given, so
// `name="city"` here means `address.city` in the form.
const AddressFieldset = forms.fieldset(AddressSchema);

interface AddressFieldsProps {
  readonly field: HandleOf<typeof AddressFieldset>
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

// 5. A component that finds the form through context, so it needs no props.
// It reads only the submission, so typing elsewhere doesn't re-render it.
function SubmitButton() {
  const form = signUp.useFormContext();
  const submission = useFormState(form, (snapshot) => snapshot.submission);
  return (
    <div className="form-actions">
      <button type="submit" className="button button-primary" disabled={submission.status === "submitting"}>
        {submission.status === "submitting" ? "Signing up..." : "Sign up"}
      </button>
      <span className="form-status" role="status">
        {submission.status === "succeeded" ? submission.result : null}
      </span>
    </div>
  );
}

// 6. The page. `useForm` makes the form once. `form.Form` puts it in context
// and hands its render function the props for the `<form>` element, plus
// `submit`, which this form doesn't need. Fields are named by path, and the
// registered components are checked against each field's type.
export default function BasicPage() {
  const form = signUp.useForm();
  const team = form.root.at("team");
  return (
    <main className="page">
      <section className="page-form">
        <form.Form>
          {({ submit: _submit, ...formProps }) => (
            <form {...formProps} className="order-form" aria-label="Sign up">
              <form.TextField name="name" label="Name" />
              <form.TextField name="email" label="Email" />
              <form.NumberField name="age" label="Age" />
              <form.Field name="newsletter">
                {(field) => (
                  <div className="field-check">
                    <input {...field.inputProps({ kind: "checkbox" })} />
                    <label htmlFor={field.id}>Send me the newsletter</label>
                  </div>
                )}
              </form.Field>
              <AddressFields field={form.root.at("address")} />
              <fieldset className="fieldset">
                <legend>Team</legend>
                <form.Items name="team">
                  {(member, index) => (
                    <div className="field-grid">
                      <form.TextField handle={member.at("name")} label={`Member ${index + 1}`} />
                      <button type="button" className="button button-small button-danger" onClick={() => team.remove(index)}>
                        Remove member {index + 1}
                      </button>
                    </div>
                  )}
                </form.Items>
                <button type="button" className="button" onClick={() => team.push()}>
                  Add member
                </button>
              </fieldset>
              <SubmitButton />
            </form>
          )}
        </form.Form>
      </section>
      {/* The example's dev panel, not part of the library. */}
      <aside className="page-inspector">
        <Inspector store={form.store} />
      </aside>
    </main>
  );
}
