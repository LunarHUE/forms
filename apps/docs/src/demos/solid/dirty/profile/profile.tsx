import { createForm, createForms } from "@lunarhue/forms-solid";
import { baselineOnSubmit, dirty } from "@lunarhue/forms-solid/plugins/dirty";
import { TextField } from "./TextField";

const forms = createForms({ plugins: [dirty()], fields: { TextField } });

const profile = forms.define({
  defaultValues: { name: "Ada Lovelace", email: "ada@example.com" },
  // A successful save makes the saved value the new baseline.
  plugins: [baselineOnSubmit()],
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
          <div>
            <button type="submit" disabled={!form.state.dirty}>
              Save
            </button>
            <button
              type="button"
              disabled={!form.state.dirty}
              onClick={() => form.root.reset()}
            >
              Discard
            </button>
          </div>
        </form>
      )}
    </form.Form>
  );
}
