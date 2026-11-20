import { checkboxProps, createForm, createForms, inputProps, numberProps, selectProps } from "@lunarhue/forms-solid";
import { Show } from "solid-js";
import { zod } from "@lunarhue/forms-schema/zod";
import { z } from "zod";
import { docsDevtools } from "@/devtools/enabled";

const forms = createForms({ plugins: [zod(), docsDevtools] });

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
  const form = createForm(signUp, { id: "sign-up" });
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
                <input {...numberProps(field)} />
                {field.shownErrors[0]?.message}
              </label>
            )}
          </form.Field>
          <form.Field name="plan">
            {(field) => (
              <label>
                Plan
                <select {...selectProps(field)}>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                </select>
              </label>
            )}
          </form.Field>
          <form.Field name="newsletter">
            {(field) => (
              <label>
                <input {...checkboxProps(field)} />
                Send me the newsletter
              </label>
            )}
          </form.Field>
          <button type="submit">Sign up</button>
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
