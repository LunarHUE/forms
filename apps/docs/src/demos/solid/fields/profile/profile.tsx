import { createForm, createForms, inputProps } from "@lunarhue/forms-solid";
import { docsDevtools } from "@/devtools/enabled";

const forms = createForms({ plugins: [docsDevtools] });

interface Profile {
  name: string;
  // Optional: starts out undefined, and an empty input shows it.
  nickname?: string;
  // A number input holds a number, or undefined while it is empty.
  age: number | undefined;
  plan: "free" | "pro";
  newsletter: boolean;
}

const profile = forms.define<Profile>({
  defaultValues: { name: "", age: undefined, plan: "free", newsletter: false },
  onSubmit: (value) => value,
});

export default function ProfileForm() {
  const form = createForm(profile, { id: "profile" });
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Field name="name">
            {(field) => (
              <label>
                Name
                <input {...inputProps(field)} />
              </label>
            )}
          </form.Field>
          <form.Field name="nickname">
            {(field) => (
              <label>
                Nickname (optional)
                <input {...inputProps(field)} />
              </label>
            )}
          </form.Field>
          <form.Field name="age">
            {(field) => (
              <label>
                Age
                <input {...inputProps(field, { kind: "number" })} />
                <output>Stored: {JSON.stringify(field.value) ?? "undefined"}</output>
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
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
