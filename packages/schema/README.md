# @lunarhue/forms-schema

Schema plugins for [forms](https://github.com/LunarHUE/forms). Each one lets a form take `schema` from
one library. The schema validates the form and gives it its types, so you
write the shape once.

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

Every form validates on its own, so the plugin only adapts the library. A
Zod schema on a form without `zod()` is a type error that names `zod()`, and
the same goes for Valibot. Starting values come from the schema.

For another [Standard Schema](https://standardschema.dev) library, make a
schema plugin with `definePlugin({ name, schema })` from `@lunarhue/forms-core/plugins`.
[Schemas](https://forms.lunarhue.dev/react/plugins/schemas#another-library)
shows how.

A helper that is generic over the schema type, such as
`function makeForm<S extends z.ZodObject>(schema: S)`, can't call `define`.
[Schema adapters](https://forms.lunarhue.dev/react/writing-plugins/schema-adapters#ts2353-from-define-in-a-function-generic-over-the-schema)
shows the form that works.

The [main README](https://github.com/LunarHUE/forms#readme) has a full example.

MIT licensed.
