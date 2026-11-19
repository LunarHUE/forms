# @lunarhue/forms-solid

The Solid adapter for [forms](https://github.com/LunarHUE/forms). Field names are checked by the compiler,
features are plugins, and a plugin you don't use costs no bytes.

The main entry binds Solid 2. On Solid 1.8 or later, import from
`@lunarhue/forms-solid/v1` instead: it has the same functions and types, so a
component moves between the two by changing the import. See [Solid 1](#solid-1).

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

## Solid 1

`@lunarhue/forms-solid/v1` is the same adapter built against Solid 1. It needs
`solid-js` 1.8 or later and no `@solidjs/web`. Plugins still come from
`@lunarhue/forms-solid/plugins`.

```tsx
import { createForm, createForms, inputProps } from "@lunarhue/forms-solid/v1";
import { render } from "solid-js/web";

const signUp = createForms().define({
  defaultValues: { name: "" },
  onSubmit: (value) => `Signed up ${value.name}.`,
});

function SignUp() {
  const form = createForm(signUp);
  return (
    <form {...form.formProps}>
      <form.Field name="name">{(field) => <input {...inputProps(field)} />}</form.Field>
      <button type="submit">Sign up</button>
      <p>{form.state.submission.status}</p>
    </form>
  );
}

render(() => <SignUp />, document.getElementById("app")!);
```

Solid 1 applies each write as it happens, where Solid 2 holds writes until
the next flush. So on Solid 1 an effect over a field can run once per write
instead of once per tick.

## Plugins

The plugins that need no other library ship with this package, all from
`@lunarhue/forms-solid/plugins`: `history`, `mask`, `rules`, `persist`,
`rebase`, `bind` and `dirty`. Your bundler drops the ones you don't import.
Validation is built in.

`mask` and `rules` work per field. Install them in the form's plugins and
put their parts where they apply: `defineField(PhoneInput, masked({ clean: digits }))`
registers a field type whose every field is masked, and
`forms.define(config, ruled({ ... }))` adds rules to one form.

## More

The [main README](https://github.com/LunarHUE/forms#readme) has the plugin guide, and
[the docs](https://forms.lunarhue.dev/solid/introduction) have a page and a demo per feature.

MIT licensed.
