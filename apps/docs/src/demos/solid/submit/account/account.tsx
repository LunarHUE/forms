import { createForm, createForms, useFormContext } from "@lunarhue/forms-solid";
import { zod } from "@lunarhue/forms-schema/zod";
import { Show } from "solid-js";
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

// `form.state` is reactive, so only these two spots update.
function SubmitButton() {
  const form = useFormContext(forms);
  return (
    <button type="submit" disabled={form.state.submitting}>
      {form.state.submitting ? "Saving..." : "Save"}
    </button>
  );
}

export default function AccountForm() {
  const form = createForm(account);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="name" label="Name" />
          <form.TextField name="email" label="Email" />
          <SubmitButton />
          <p role="status">
            <Show when={form.state.submission.status === "succeeded" && form.state.submission}>
              {(submission) => submission().result}
            </Show>
          </p>
        </form>
      )}
    </form.Form>
  );
}
