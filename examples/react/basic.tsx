import {
  createForms,
  errorId,
  type FieldApi,
  type HandleOf,
  useField,
  useForm,
  useFormContext,
  useFormState,
} from "@lunarhue/forms-react";
import { valibot } from "@lunarhue/forms-schema/valibot";
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

// A field component is a plain component with a `field` prop.
// `inputProps()` carries the value, the handlers and the aria
// attributes that point at `field.errorId`.
interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function TextField({ field, label }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={field.id}>{label}</label>
      <input {...field.inputProps()} />
      <ul id={field.errorId}>
        {field.shownErrors.map((error) => (
          <li key={error.message}>{error.message}</li>
        ))}
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

function AddressFields({ field }: AddressFieldsProps) {
  const scope = AddressFieldset.scope(field);
  return (
    <fieldset>
      <legend>Address</legend>
      <scope.TextField name="street" label="Street" />
      <scope.TextField name="city" label="City" />
    </fieldset>
  );
}

// Finds the nearest form of `forms` through context, so it needs no
// props. It reads only `submitting`, so typing doesn't re-render it.
function SubmitButton() {
  const form = useFormContext(forms);
  const submitting = useFormState(
    form,
    (state) => state.submitting,
  );
  return (
    <button type="submit" disabled={submitting}>
      {submitting ? "Signing up..." : "Sign up"}
    </button>
  );
}

export default function SignUpForm() {
  const form = useForm(signUp);
  // Errors on the form as a whole sit on the root, such as a
  // server's. Without this list nothing would show them.
  const formErrors = useField(
    form.root,
    (snapshot) => snapshot.shownErrors,
  );
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <ul id={errorId(form.root)}>
            {formErrors.map((error) => (
              <li key={error.message}>{error.message}</li>
            ))}
          </ul>
          <form.TextField name="name" label="Name" />
          <form.TextField name="email" label="Email" />
          <AddressFields field={form.root.at("address")} />
          <SubmitButton />
          <form.State select={(state) => state.submission}>
            {(submission) => (
              <p role="status">
                {submission.status === "succeeded"
                  ? submission.result
                  : null}
              </p>
            )}
          </form.State>
        </form>
      )}
    </form.Form>
  );
}
