import {
  createForms,
  type FieldApi,
  useForm,
} from "@lunarhue/forms-react";
import { baselineOnSubmit, dirty } from "@lunarhue/forms-react/plugins/dirty";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// `field.dirty` is true while the value differs from where it started.
function TextField({ field, label }: TextFieldProps) {
  return (
    <label>
      {label}
      {field.dirty ? " (changed)" : null}
      <input {...field.inputProps()} />
    </label>
  );
}

// Without `dirty()`, `dirty` is always false.
const forms = createForms({
  plugins: [dirty()],
  fields: { TextField },
});

// `baselineOnSubmit()` makes what a successful save sent the new
// starting point, so the form is clean once the save is done.
const profile = forms.define({
  defaultValues: { name: "Ada Lovelace", email: "ada@example.com" },
  plugins: [baselineOnSubmit()],
  onSubmit: (value) => value,
});

export default function ProfileForm() {
  const form = useForm(profile);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="name" label="Name" />
          <form.TextField name="email" label="Email" />
          {/* Typing a field back to its old value makes it clean
              again, and so does a save. Both disable the button. */}
          <form.State select={(state) => state.dirty}>
            {(changed) => (
              <>
                <button type="submit" disabled={!changed}>
                  Save
                </button>
                <button
                  type="button"
                  disabled={!changed}
                  onClick={() => form.root.reset()}
                >
                  Undo changes
                </button>
              </>
            )}
          </form.State>
        </form>
      )}
    </form.Form>
  );
}
