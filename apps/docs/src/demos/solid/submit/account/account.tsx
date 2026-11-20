import { createForm, createForms, useFormContext } from "@lunarhue/forms-solid";
import { Show } from "solid-js";
import { saveAccount } from "./server";
import { TextInput } from "./TextInput";

const forms = createForms();

const account = forms.define({
  defaultValues: { name: "", email: "" },
  validate: {
    fields: {
      name: (name) => (name === "" ? { message: "Enter your name." } : undefined),
      email: (email) => (email.includes("@") ? undefined : { message: "Enter a valid email." }),
    },
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
          <form.Field name="name">{(field) => <TextInput field={field} label="Name" />}</form.Field>
          <form.Field name="email">{(field) => <TextInput field={field} label="Email" type="email" />}</form.Field>
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
