// A login form: two fields checked by a Valibot schema, no schema plugin. On the /mini entry.
import { createForms, inputProps, useForm } from "@lunarhue/forms-react/mini";
import * as v from "valibot";

const forms = createForms();
const login = forms.define({
  defaultValues: { email: "", password: "" },
  schema: v.object({
    email: v.pipe(v.string(), v.email("Enter an email.")),
    password: v.pipe(v.string(), v.minLength(8, "At least 8 characters.")),
  }),
  onSubmit: async (value) => {
    await fetch("/login", { method: "POST", body: JSON.stringify(value) });
  },
});

export function App() {
  const form = useForm(login);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Field name="email">
            {(field) => (
              <>
                <input {...inputProps(field, { type: "email" })} />
                <p id={field.errorId}>{field.shownErrors[0]?.message}</p>
              </>
            )}
          </form.Field>
          <form.Field name="password">
            {(field) => (
              <>
                <input {...inputProps(field, { type: "password" })} />
                <p id={field.errorId}>{field.shownErrors[0]?.message}</p>
              </>
            )}
          </form.Field>
          <button type="submit">Sign in</button>
        </form>
      )}
    </form.Form>
  );
}
