# @lunarhue/forms-react

The React adapter for [forms](https://github.com/LunarHUE/forms). Field names are checked by the compiler,
features are plugins, and a plugin you don't use costs no bytes. Works with
React 16.8 and later.

```sh
npm install @lunarhue/forms-react
```

For schema validation add `@lunarhue/forms-schema` and Zod or Valibot.

## A form

```tsx
import { createForms, inputProps, useForm, type FieldApi } from "@lunarhue/forms-react";
import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";

const SignUp = v.object({
  name: v.pipe(v.string(), v.nonEmpty("Enter your name.")),
  email: v.pipe(v.string(), v.email("Enter a valid email.")),
});

// Your own input, registered once. `inputProps(field)` carries the value,
// the handlers and the aria attributes.
interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function TextField({ field, label }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={field.id}>{label}</label>
      <input {...inputProps(field)} />
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

const signUp = forms.define({
  schema: SignUp,
  onSubmit: (value) => `Signed up ${value.name}.`,
});

export default function SignUpForm() {
  const form = useForm(signUp);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="name" label="Name" />
          <form.TextField name="email" label="Email" />
          <button type="submit">Sign up</button>
        </form>
      )}
    </form.Form>
  );
}
```

Type `name="emial"` and the build fails.

## Plugins

The plugins that need no other library ship with this package, one entry
each: `@lunarhue/forms-react/plugins/history`, `/mask`, `/rules`,
`/persist`, `/rebase`, `/bind` and `/dirty`. Validation is built in.

## More

The [main README](https://github.com/LunarHUE/forms#readme) has a longer example and the plugin guide, and
[the docs](https://forms.lunarhue.dev/react/introduction) have a page and a demo per feature.

MIT licensed.
