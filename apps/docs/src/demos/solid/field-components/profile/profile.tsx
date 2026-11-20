import { createForm, createForms, fieldValidators } from "@lunarhue/forms-solid";
import { CheckboxField, NumberField, TextField } from "./fields";
import { docsDevtools } from "@/devtools/enabled";

// Registered once. Every form from `forms` gets `form.TextField` and the rest.
const forms = createForms({ plugins: [docsDevtools], fields: { TextField, NumberField, CheckboxField } });

interface Profile {
  name: string;
  nickname?: string;
  age: number | undefined;
  newsletter: boolean;
}

const profile = forms.define<Profile>({
  defaultValues: { name: "", age: undefined, newsletter: false },
  validate: {
    fields: fieldValidators({
      age: (age) => (age === undefined || age < 18 ? { message: "You must be 18 or over." } : undefined),
    }),
  },
  onSubmit: (value) => value,
});

export default function ProfileForm() {
  const form = createForm(profile, { id: "profile" });
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField
            name="name"
            label="Name"
            validate={(name) => (name ? undefined : { message: "Enter your name." })}
          />
          <form.TextField name="nickname" label="Nickname (optional)" />
          <form.NumberField name="age" label="Age" />
          <form.CheckboxField name="newsletter" label="Send me the newsletter" />
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
