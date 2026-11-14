# @lunarhue/forms-schema

Schema plugins for [forms](https://github.com/LunarHUE/forms). The schema validates the form and gives it
its types, so you write the shape once.

```sh
npm install @lunarhue/forms-schema zod       # or valibot
```

You also need an adapter, `@lunarhue/forms-react` or `@lunarhue/forms-solid`.

| Plugin | Import | Library |
| --- | --- | --- |
| `zod()` | `@lunarhue/forms-schema/zod` | Zod 4 |
| `valibot()` | `@lunarhue/forms-schema/valibot` | Valibot 1 |

```ts
import { createForms } from "@lunarhue/forms-react";
import { zod } from "@lunarhue/forms-schema/zod";
import { z } from "zod";

const forms = createForms({ plugins: [zod()] });

const signUp = forms.define({
  schema: z.object({
    name: z.string().min(1, "Enter your name."),
    email: z.email("Enter a valid email."),
  }),
  onSubmit: (value) => `Signed up ${value.name}.`,
});
```

Each plugin brings validation with it, so you don't list `validation()` as
well. Starting values come from the schema.

Any other [Standard Schema](https://standardschema.dev) works as `schema`
with the plain `validation()` plugin. You give `defaultValues` yourself in
that case.

The [main README](https://github.com/LunarHUE/forms#readme) has a full example.

MIT licensed.
