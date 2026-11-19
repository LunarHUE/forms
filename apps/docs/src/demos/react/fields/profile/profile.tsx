import { createForms, useForm } from "@lunarhue/forms-react";
import { zod } from "@lunarhue/forms-schema/zod";
import { z } from "zod";
import { NumberField } from "./NumberField";
import { TextField } from "./TextField";

// Registered once, available on every form as `form.TextField` and
// `form.NumberField`.
const forms = createForms({
  plugins: [zod()],
  fields: { TextField, NumberField },
});

const Profile = z.object({
  name: z.string().min(1, "Enter your name."),
  age: z.number("Enter your age.").int().min(18, "You must be 18 or over."),
});

const profile = forms.define({
  schema: Profile,
  onSubmit: (value) => value,
});

export default function ProfileForm() {
  const form = useForm(profile);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="name" label="Name" />
          <form.NumberField name="age" label="Age" />
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
