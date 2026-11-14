# @lunarhue/forms-solid

The Solid adapter for [forms](https://github.com/LunarHUE/forms). Field names are checked by the compiler,
features are plugins, and a plugin you don't use costs no bytes.

Solid 2 is the main entry. Solid 1.8 and later is at
`@lunarhue/forms-solid/v1`.

```sh
npm install @lunarhue/forms-solid
```

For schema validation add `@lunarhue/forms-schema` and Zod or Valibot.

## A form

```tsx
import { createForm, createForms, type FieldApi } from "@lunarhue/forms-solid";
import { valibot } from "@lunarhue/forms-schema/valibot";
import { For } from "solid-js";
import * as v from "valibot";

const SignUp = v.object({
  name: v.pipe(v.string(), v.nonEmpty("Enter your name.")),
  email: v.pipe(v.string(), v.email("Enter a valid email.")),
});

// Your own input, registered once. Read it through `props` so it stays
// reactive. `inputProps()` carries the value, the handlers and the aria
// attributes.
interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function TextField(props: TextFieldProps) {
  return (
    <div>
      <label for={props.field.id}>{props.label}</label>
      <input {...props.field.inputProps()} />
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
`/persist`, `/rebase`, `/bind`, `/dirty` and `/validation`.

## More

The [main README](https://github.com/LunarHUE/forms#readme) has the plugin guide, and
[examples/solid](https://github.com/LunarHUE/forms/tree/main/examples/solid) has one file per feature.

MIT licensed.
