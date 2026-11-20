import { createForms, inputProps, useForm } from "@lunarhue/forms-react";
import { zod } from "@lunarhue/forms-schema/zod";
import { z } from "zod";

const forms = createForms({ plugins: [zod()] });

const SignUp = z.object({
  name: z.string().min(1, "Enter your name."),
  // A number has no empty value, so it starts undefined.
  age: z.number("Enter your age.").int().min(18, "You must be 18 or over."),
  plan: z.enum(["free", "pro"]).default("free"),
  newsletter: z.boolean(),
});

// No defaultValues: zod() works them out from the schema.
const signUp = forms.define({
  schema: SignUp,
  onSubmit: (value) => `Signed up ${value.name} on ${value.plan}.`,
});

export default function SignUpForm() {
  const form = useForm(signUp);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Field name="name">
            {(field) => (
              <label>
                Name
                <input {...inputProps(field)} />
                {field.shownErrors[0]?.message}
              </label>
            )}
          </form.Field>
          <form.Field name="age">
            {(field) => (
              <label>
                Age
                <input {...inputProps(field, { kind: "number" })} />
                {field.shownErrors[0]?.message}
              </label>
            )}
          </form.Field>
          <form.Field name="plan">
            {(field) => (
              <label>
                Plan
                <select {...inputProps(field, { kind: "select" })}>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                </select>
              </label>
            )}
          </form.Field>
          <form.Field name="newsletter">
            {(field) => (
              <label>
                <input {...inputProps(field, { kind: "checkbox" })} />
                Send me the newsletter
              </label>
            )}
          </form.Field>
          <button type="submit">Sign up</button>
          <form.State select={(state) => state.submission}>
            {(submission) => <p role="status">{submission.status === "succeeded" ? submission.result : null}</p>}
          </form.State>
        </form>
      )}
    </form.Form>
  );
}
