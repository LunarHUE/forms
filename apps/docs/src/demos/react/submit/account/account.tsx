import { createForms, fieldValidators, useForm, useFormContext, useFormState } from "@lunarhue/forms-react";
import { saveAccount } from "./server";
import { TextInput } from "./TextInput";
import { docsDevtools } from "@/devtools/enabled";

const forms = createForms({ plugins: [docsDevtools] });

const account = forms.define({
  defaultValues: { name: "", email: "" },
  validate: {
    fields: fieldValidators({
      name: (name) => (name === "" ? { message: "Enter your name." } : undefined),
      email: (email) => (email.includes("@") ? undefined : { message: "Enter a valid email." }),
    }),
  },
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
  const form = useForm(account, { id: "account" });
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Field name="name">{(field) => <TextInput field={field} label="Name" />}</form.Field>
          <form.Field name="email">{(field) => <TextInput field={field} label="Email" type="email" />}</form.Field>
          <SubmitButton />
          <form.State select={(state) => state.submission}>
            {(submission) => <p role="status">{submission.status === "succeeded" ? submission.result : null}</p>}
          </form.State>
        </form>
      )}
    </form.Form>
  );
}
