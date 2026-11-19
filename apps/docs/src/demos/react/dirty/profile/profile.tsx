import { createForms, useForm } from "@lunarhue/forms-react";
import { baselineOnSubmit, dirty } from "@lunarhue/forms-react/plugins/dirty";
import { TextField } from "./TextField";

const forms = createForms({ plugins: [dirty()], fields: { TextField } });

const profile = forms.define({
  defaultValues: { name: "Ada Lovelace", email: "ada@example.com" },
  // A successful save makes the saved value the new baseline.
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
          <form.State select={(state) => state.dirty}>
            {(changed) => (
              <div>
                <button type="submit" disabled={!changed}>
                  Save
                </button>
                <button
                  type="button"
                  disabled={!changed}
                  onClick={() => form.root.reset()}
                >
                  Discard
                </button>
              </div>
            )}
          </form.State>
        </form>
      )}
    </form.Form>
  );
}
