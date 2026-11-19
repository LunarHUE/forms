# @lunarhue/forms-solid

The Solid adapter for [forms](https://github.com/LunarHUE/forms). Field names are checked by the compiler,
features are plugins, and a plugin you don't use costs no bytes.

This adapter needs Solid 2. Solid 1 support is not there yet. The
`@lunarhue/forms-solid/v1` entry only re-exports core for now, and
[#124](https://github.com/LunarHUE/forms/issues/124) tracks the real adapter.

```sh
npm install @lunarhue/forms-solid
```

For schema validation add `@lunarhue/forms-schema` and Zod or Valibot.

## A form

```tsx
import { createForm, createForms, inputProps, type FieldApi } from "@lunarhue/forms-solid";
import { valibot } from "@lunarhue/forms-schema/valibot";
import { For } from "solid-js";
import * as v from "valibot";

const SignUp = v.object({
  name: v.pipe(v.string(), v.nonEmpty("Enter your name.")),
  email: v.pipe(v.string(), v.email("Enter a valid email.")),
});

// Your own input, registered once. Read it through `props` so it stays
// reactive. `inputProps(props.field)` carries the value, the handlers and
// the aria attributes.
interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function TextField(props: TextFieldProps) {
  return (
    <div>
      <label for={props.field.id}>{props.label}</label>
      <input {...inputProps(props.field)} />
      <ul id={props.field.errorId}>
        <For each={props.field.shownErrors}>
          {(error) => <li>{error.message}</li>}
        </For>
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
  const form = createForm(signUp);
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
each: `@lunarhue/forms-solid/plugins/history`, `/mask`, `/rules`,
`/persist`, `/rebase`, `/bind` and `/dirty`. Validation is built in.

## More

The [main README](https://github.com/LunarHUE/forms#readme) has the plugin guide, and
[the docs](https://forms.lunarhue.dev/solid/introduction) have a page and a demo per feature.

MIT licensed.
