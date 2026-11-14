import { valibot } from "@lunarhue/forms-schema/valibot";
import {
  createField,
  createForm,
  createForms,
  type FieldApi,
  type HandleOf,
  useFormContext,
} from "@lunarhue/forms-solid";
import { For } from "solid-js";
import * as v from "valibot";

// The schema validates the form and gives it its types.
const Address = v.object({
  street: v.pipe(v.string(), v.nonEmpty("Enter a street.")),
  city: v.pipe(v.string(), v.nonEmpty("Enter a city.")),
});

const SignUp = v.object({
  name: v.pipe(v.string(), v.nonEmpty("Enter your name.")),
  email: v.pipe(v.string(), v.email("Enter a valid email.")),
  address: Address,
});

// A field component is a plain component with a `field` prop. Read
// it through `props` so it stays reactive. `inputProps()` carries the
// value, the handlers and the aria attributes.
interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function TextField(props: TextFieldProps) {
  return (
    <div>
      <label for={props.field.id}>{props.label}</label>
      <input {...props.field.inputProps()} />
      <ul id={props.field.errorId}>
        <For each={props.field.shownErrors}>
          {(error) => <li>{error.message}</li>}
        </For>
      </ul>
    </div>
  );
}

// One `createForms` for the app. Every form it defines gets
// `form.TextField`.
const forms = createForms({
  plugins: [valibot()],
  fields: { TextField },
});

// What `onSubmit` returns becomes the submission's result.
const signUp = forms.define({
  schema: SignUp,
  onSubmit: (value) => `Signed up ${value.name}.`,
});

// A reusable group. `name="city"` here means `address.city`.
const AddressFieldset = forms.fieldset(Address);

interface AddressFieldsProps {
  readonly field: HandleOf<typeof AddressFieldset>;
}

function AddressFields(props: AddressFieldsProps) {
  const scope = AddressFieldset.scope(props.field);
  return (
    <fieldset>
      <legend>Address</legend>
      <scope.TextField name="street" label="Street" />
      <scope.TextField name="city" label="City" />
    </fieldset>
  );
}

// Finds the nearest form of `forms` through context. `form.state` is
// reactive, so only this text updates when `submitting` changes.
function SubmitButton() {
  const form = useFormContext(forms);
  return (
    <button type="submit" disabled={form.state.submitting}>
      {form.state.submitting ? "Signing up..." : "Sign up"}
    </button>
  );
}

export default function SignUpForm() {
  const form = createForm(signUp);
  // Errors on the form as a whole sit on the root, such as a
  // server's. Without this list nothing would show them.
  const root = createField(form.root);
  const result = () => {
    const submission = form.state.submission;
    return submission.status === "succeeded" ? submission.result : null;
  };
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <ul id={root.errorId}>
            <For each={root.shownErrors}>
              {(error) => <li>{error.message}</li>}
            </For>
          </ul>
          <form.TextField name="name" label="Name" />
          <form.TextField name="email" label="Email" />
          <AddressFields field={form.root.at("address")} />
          <SubmitButton />
          <p role="status">{result()}</p>
        </form>
      )}
    </form.Form>
  );
}
