import { createForm, createForms, debounced, fieldValidators, validateOn } from "@lunarhue/forms-solid";
import { Show } from "solid-js";
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
      // Checks while the user types, not only after they leave the field.
      username: validateOn(
        // Waits for a pause in typing. Submit skips the wait.
        debounced(
          // A newer run aborts this one's `signal` and drops its result.
          async (name, { signal }) =>
            (await isTaken(name, signal)) ? { message: "That name is taken." } : undefined,
          400,
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
  const form = createForm(account, { id: "username" });
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
      <p role="status">
        <Show when={form.state.submission.status === "succeeded" && form.state.submission}>
          {(submission) => submission().result}
        </Show>
      </p>
    </form>
  );
}
