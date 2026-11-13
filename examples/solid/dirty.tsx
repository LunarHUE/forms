import {
  createForm,
  createForms,
  type FieldApi,
} from "@lunarhue/forms-solid";
import { dirty } from "@lunarhue/forms-solid/plugins/dirty";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// `field.dirty` is true while the value differs from where it started.
function TextField(props: TextFieldProps) {
  return (
    <label>
      {props.label}
      {props.field.dirty ? " (changed)" : null}
      <input {...props.field.inputProps()} />
    </label>
  );
}

// Without `dirty()`, `dirty` is always false.
const forms = createForms({
  plugins: [dirty()],
  fields: { TextField },
});

const profile = forms.define({
  defaultValues: { name: "Ada Lovelace", email: "ada@example.com" },
  onSubmit: (value) => value,
});

export default function ProfileForm() {
  const form = createForm(profile);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="name" label="Name" />
          <form.TextField name="email" label="Email" />
          {/* Typing a field back to its old value makes it clean
              again, and the buttons go back to disabled. */}
          <button type="submit" disabled={!form.state.dirty}>
            Save
          </button>
          <button
            type="button"
            disabled={!form.state.dirty}
            onClick={() => form.root.reset()}
          >
            Undo changes
          </button>
        </form>
      )}
    </form.Form>
  );
}
