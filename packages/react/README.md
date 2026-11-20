# @lunarhue/forms-react

The React adapter for [forms](https://github.com/LunarHUE/forms). Field names are checked by the compiler,
features are plugins, and a plugin you don't use costs no bytes. Works with
React 18 and later, and with React 16.8 and 17 through a resolve condition.

```sh
npm install @lunarhue/forms-react
```

## React 16.8 and 17

The default build uses React 18's `useSyncExternalStore` and `useId`. On
React 16.8 or 17, have your bundler resolve with the `@lunarhue/react-legacy`
condition, which picks a build with fallbacks for both. Without it, a
development build throws `react:legacy` when the adapter loads.

```ts
// Vite
import { defaultClientConditions, defaultServerConditions, defineConfig } from "vite";

export default defineConfig({
  resolve: { conditions: ["@lunarhue/react-legacy", ...defaultClientConditions] },
  ssr: {
    resolve: {
      conditions: ["@lunarhue/react-legacy", ...defaultServerConditions],
      externalConditions: ["@lunarhue/react-legacy"],
    },
  },
});
```

```js
// webpack or Rspack
resolve: { conditionNames: ["@lunarhue/react-legacy", "..."] }

// esbuild. Custom conditions drop the default `module`, so list it again.
conditions: ["@lunarhue/react-legacy", "module"]

// Next with webpack, in next.config.js
webpack(config) {
  config.resolve.conditionNames = ["@lunarhue/react-legacy", ...(config.resolve.conditionNames ?? ["..."])];
  return config;
}

// Next with Turbopack, which has no conditions setting, in next.config.js
turbopack: { resolveAlias: { "#lunarhue/react": "@lunarhue/forms-react/legacy" } }
```

When Node loads the adapter itself, as an unbundled server does, run it with
`NODE_OPTIONS=--conditions=@lunarhue/react-legacy`.

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

The plugins that need no other library ship with this package, all from
`@lunarhue/forms-react/plugins`: `history`, `mask`, `rules`, `persist`,
`rebase`, `bind` and `dirty`. Your bundler drops the ones you don't import.
Validation is built in.

`mask` and `rules` work per field. Install them in the form's plugins and
put their parts where they apply: `defineField(PhoneInput, masked({ clean: digits }))`
registers a field type whose every field is masked, and
`forms.define(config, ruled({ ... }))` adds rules to one form.

## More

The [main README](https://github.com/LunarHUE/forms#readme) has a longer example and the plugin guide, and
[the docs](https://forms.lunarhue.dev/react/introduction) have a page and a demo per feature.

MIT licensed.
