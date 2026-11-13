import {
  createForms,
  type FieldApi,
  useForm,
} from "@lunarhue/forms-react";
import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function TextField({ field, label }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={field.id}>{label}</label>
      <input {...field.inputProps()} />
      {field.validating ? <span>Checking...</span> : null}
      <ul id={field.errorId}>
        {field.shownErrors.map((error) => (
          <li key={error.message}>{error.message}</li>
        ))}
      </ul>
    </div>
  );
}

const forms = createForms({
  plugins: [valibot()],
  fields: { TextField },
});

const SignUp = v.object({
  username: v.pipe(v.string(), v.minLength(3, "Too short.")),
});

// The server answers 200 when someone already has the name.
async function isTaken(name: string, signal: AbortSignal) {
  const url = `/api/users/${encodeURIComponent(name)}`;
  const response = await fetch(url, { signal });
  return response.ok;
}

const signUp = forms.define({
  schema: SignUp,
  validate: {
    fields: {
      username: {
        // A validator that returns a promise is async. When the user
        // types again, the older run's `signal` aborts and its result
        // is dropped, so a slow answer never wins over a newer one.
        validate: async (name, { signal }) =>
          (await isTaken(name, signal))
            ? { message: "That name is taken." }
            : undefined,
        // Wait for a pause in typing. Submit skips the wait.
        debounce: 400,
      },
    },
  },
  onSubmit: (value) => value.username,
});

export default function UsernameForm() {
  const form = useForm(signUp);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="username" label="Username" />
          {/* Submit waits for a check still running, and goes on
              only if it passed. */}
          <button type="submit">Sign up</button>
        </form>
      )}
    </form.Form>
  );
}
