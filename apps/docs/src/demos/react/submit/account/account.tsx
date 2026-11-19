import { createForms, useForm, useFormContext, useFormState } from "@lunarhue/forms-react";
import { zod } from "@lunarhue/forms-schema/zod";
import { z } from "zod";
import { saveAccount } from "./server";
import { TextField } from "./TextField";

const forms = createForms({
  plugins: [zod()],
  fields: { TextField },
});

const Account = z.object({
  name: z.string().min(1, "Enter your name."),
  email: z.email("Enter a valid email."),
});

const account = forms.define({
  schema: Account,
  // Runs only once the value is valid. What it returns is the result.
  onSubmit: async (value, { store }) => {
    const response = await saveAccount(value);
    if (!response.ok) {
      // The server said no: show why on the field.
      store.setErrors({ fields: { email: { message: response.error } } });
      return null;
    }
    return `Saved ${value.name}.`;
  },
});

// Reads only `submitting`, so typing doesn't re-render it.
function SubmitButton() {
  const form = useFormContext(forms);
  const submitting = useFormState(form, (state) => state.submitting);
  return (
    <button type="submit" disabled={submitting}>
      {submitting ? "Saving..." : "Save"}
    </button>
  );
}

export default function AccountForm() {
  const form = useForm(account);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="name" label="Name" />
          <form.TextField name="email" label="Email" />
          <SubmitButton />
          <form.State select={(state) => state.submission}>
            {(submission) => <p role="status">{submission.status === "succeeded" ? submission.result : null}</p>}
          </form.State>
        </form>
      )}
    </form.Form>
  );
}
