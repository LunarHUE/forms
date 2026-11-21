import { createForms, debounced, fieldValidators, pipe, useForm, validateOn } from "@lunarhue/forms-react";
import { TextInput } from "./TextInput";
import { docsDevtools } from "@/devtools/enabled";

const forms = createForms({ plugins: [docsDevtools] });

// Stands in for a request to your server. "ada" and "grace" are taken.
function isTaken(name: string, signal: AbortSignal) {
  return new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => resolve(["ada", "grace"].includes(name)), 600);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

const account = forms.define({
  defaultValues: { username: "" },
  validate: {
    fields: fieldValidators({
      // Cheap local checks run first; the server check only starts once they pass.
      username: validateOn(
        pipe(
          (name) => (name.length < 3 ? { message: "Use at least 3 characters." } : undefined),
          (name) => (/^[a-z0-9_]+$/i.test(name) ? undefined : { message: "Use letters, digits and underscores." }),
          debounced(
            async (name, { signal }) =>
              (await isTaken(name, signal)) ? { message: "That name is taken." } : undefined,
            400,
          ),
        ),
        "input",
      ),
    }),
  },
  // Shows the answer while the user is still in the field.
  show: "always",
  onSubmit: (value) => `Claimed ${value.username}.`,
});

export default function UsernameForm() {
  const form = useForm(account, { id: "username" });
  return (
    <form {...form.formProps}>
      <form.Field name="username">
        {(field) => (
          <>
            <TextInput field={field} label="Username" />
            <p role="status">{field.validating ? "Checking..." : null}</p>
          </>
        )}
      </form.Field>
      <button type="submit">Claim</button>
      <form.State select={(state) => state.submission}>
        {(submission) => <p role="status">{submission.status === "succeeded" ? submission.result : null}</p>}
      </form.State>
    </form>
  );
}
