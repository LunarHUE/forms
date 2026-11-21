import { checkboxProps, createForm, createForms, fieldValidators, formValidator, pipe } from "@lunarhue/forms-solid";
import { For, Show } from "solid-js";
import { TextInput } from "./TextInput";
import { docsDevtools } from "@/devtools/enabled";

const forms = createForms({ plugins: [docsDevtools] });

const signUp = forms.define({
  defaultValues: { username: "", password: "", confirm: "", terms: false },
  validate: {
    // One function or pipe per field. Return an error, or undefined when it passes.
    fields: fieldValidators({
      username: pipe(
        (name) => (name.length < 3 ? { message: "Use at least 3 characters." } : undefined),
        (name) => (/^[a-z0-9_]+$/i.test(name) ? undefined : { message: "Use letters, digits and underscores." }),
      ),
      password: (password) => (password.length < 8 ? { message: "Use at least 8 characters." } : undefined),
    }),
    // Sees the whole value, so it can compare two fields.
    form: formValidator((value) =>
      value.confirm === value.password ? undefined : { fields: { confirm: { message: "The passwords don't match." } } },
    ),
  },
  onSubmit: (value) => `Signed up ${value.username}.`,
});

export default function SignUpForm() {
  const form = createForm(signUp, { id: "sign-up" });
  return (
    <form {...form.formProps}>
      <form.Field name="username">{(field) => <TextInput field={field} label="Username" />}</form.Field>
      <form.Field name="password">
        {(field) => <TextInput field={field} label="Password" type="password" />}
      </form.Field>
      <form.Field name="confirm">
        {(field) => <TextInput field={field} label="Repeat the password" type="password" />}
      </form.Field>
      {/* A validator from the component, added while it is mounted. */}
      <form.Field name="terms" validate={(accepted) => (accepted ? undefined : { message: "Accept the terms." })}>
        {(field) => (
          <div>
            <label>
              <input {...checkboxProps(field)} />I accept the terms
            </label>
            <ul id={field.errorId}>
              <For each={field.shownErrors}>{(error) => <li>{error.message}</li>}</For>
            </ul>
          </div>
        )}
      </form.Field>
      <button type="submit">Sign up</button>
      <p role="status">
        <Show when={form.state.submission.status === "succeeded" && form.state.submission}>
          {(submission) => submission().result}
        </Show>
      </p>
    </form>
  );
}
