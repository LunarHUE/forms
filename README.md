# forms

Forms for React and Solid, with the form logic in one small core that knows
nothing about either. A Vue adapter is planned.

We wrote it because we wanted three things at once: field names the compiler
checks, a bundle well under what the big form libraries ship, and a way to add
features without everyone paying for them. So the core does values, arrays,
validation and submit, since checking input is what a form library is for.
Undo, masks, schema libraries and the rest are plugins you install.

## Install

```sh
npm install @lunarhue/forms-react    # React 16.8 and later
npm install @lunarhue/forms-solid    # Solid 2
```

The adapter brings the core and the plugins that need no other library. Add
these when you want them:

```sh
npm install @lunarhue/forms-schema zod    # or valibot
npm install @lunarhue/forms-bind          # Zustand or a Solid signal
```

## What it looks like

A profile form in React. Zod validates it, the address is a reusable fieldset,
and Refresh pulls the server's copy without wiping what the user has typed.

It is also bound to a Zustand store. That part is easy to misread, so to be
clear: the form's state does not live in Zustand. The form always keeps its own
store, with the values, errors, touched flags and everything else. The binding
only keeps the two in step. A change in the form is copied out to your store,
and a change in your store is copied into the form. Take the binding away and
the form works exactly the same.

```tsx
import { z } from "zod";
import { create } from "zustand";
import {
  createForms,
  inputProps,
  useForm,
  useFormContext,
  useFormState,
  type FieldApi,
  type HandleOf,
} from "@lunarhue/forms-react";
import { rebase } from "@lunarhue/forms-react/plugins";
import { zod } from "@lunarhue/forms-schema/zod";
import { zustand } from "@lunarhue/forms-bind/zustand";

// Your own input, registered once.
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

// One plugin list. Zod brings validation.
// Rebase merges fresh server data.
const forms = createForms({
  plugins: [zod(), rebase()],
  fields: { TextField },
});

const Address = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
});

const Profile = z.object({
  name: z.string().min(1),
  email: z.email(),
  address: Address,
});

// A store your app already has. The form does not
// live in it. The binding below copies values both ways.
const useProfileStore = create(() => ({
  name: "",
  email: "",
  address: { street: "", city: "" },
}));

const saveProfile = (value: z.infer<typeof Profile>) =>
  fetch("/api/profile", {
    method: "PUT",
    body: JSON.stringify(value),
  });

const profile = forms.define({
  schema: Profile,
  // Keep this form's value and the store in step.
  plugins: [zustand(useProfileStore)],
  onSubmit: saveProfile,
});

// A reusable group of fields,
// usable under any form with an address.
const AddressFieldset = forms.fieldset(Address);

interface AddressFieldsProps {
  readonly field: HandleOf<typeof AddressFieldset>;
}

function AddressFields({ field }: AddressFieldsProps) {
  const scope = AddressFieldset.scope(field);
  return (
    <fieldset>
      <scope.TextField name="street" label="Street" />
      <scope.TextField name="city" label="City" />
    </fieldset>
  );
}

// Works under any form.
function SubmitButton() {
  const form = useFormContext();
  const submitting = useFormState(
    form,
    (state) => state.submitting,
  );
  return (
    <button type="submit" disabled={submitting}>
      Save
    </button>
  );
}

export default function ProfileForm() {
  const form = useForm(profile);

  // Take the server's copy,
  // but keep whatever the user has typed.
  const refresh = async () => {
    const response = await fetch("/api/profile");
    const fresh = await response.json();
    form.plugins.rebase(form.root, fresh, (leaf) =>
      leaf.edited ? "keep" : "take",
    );
  };

  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="name" label="Name" />
          <form.TextField name="email" label="Email" />
          <AddressFields field={form.root.at("address")} />
          <SubmitButton />
          <button type="button" onClick={refresh}>
            Refresh
          </button>
        </form>
      )}
    </form.Form>
  );
}
```

Type `name="emial"` and the build fails. Same if you pass a Zod schema with
no `zod()` in the list.

## Packages

| Package                  | What it is                                       |
| ------------------------ | ------------------------------------------------ |
| `@lunarhue/forms-core`   | The core, plus the plugins that need nothing else |
| `@lunarhue/forms-react`  | React adapter, React 16.8 and later              |
| `@lunarhue/forms-solid`  | Solid adapter, Solid 2                           |
| `@lunarhue/forms-schema` | Schema plugins: `./valibot` and `./zod`          |
| `@lunarhue/forms-bind`   | Bindings to outside stores: `./zustand` and `./solid` |

## Plugins

Everything goes in one list, on `createForms` for every form or on `define`
for one form. A plugin you don't install costs you no bytes.

We sort them by one question: does it need someone else's library?

### First class

No dependencies beyond core. They live in core and each adapter re-exports
them, so you import from the package you already have.

| Plugin         | What it does                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `history()`    | Undo and redo. One step per keystroke or batch, and array rows keep their identity.            |
| `mask()`       | Cleans a value on its way into the store, for each field type that carries `masked(...)`.      |
| `rules()`      | Works out `disabled` and `hidden` for a field from the form's value, with `ruled(...)` parts.  |
| `persist()`    | Saves the draft to storage when the page is idle and restores it on load.                      |
| `rebase()`     | Takes a fresh copy of the data and lets you decide, leaf by leaf, whether to keep the user's edit. |
| `bind()`       | Copies the form's value to a store you own and back. The form keeps its own state; only the value is shared. |

### Schema

These work with a schema library, so they sit in `@lunarhue/forms-schema`, one
entry per library. Validation is already in every form, so each one only
adapts its library: it lets `schema` take that library's schemas and fills in
the starting values.

| Plugin      | Import                           | What it does                                           |
| ----------- | -------------------------------- | ------------------------------------------------------ |
| `zod()`     | `@lunarhue/forms-schema/zod`     | Validates with Zod 4 and types the form from the schema. |
| `valibot()` | `@lunarhue/forms-schema/valibot` | The same for Valibot.                                  |

For any other [Standard Schema](https://standardschema.dev) library, make a
schema plugin with `definePlugin({ name, schema })`. See
[Schemas](https://forms.lunarhue.dev/react/plugins/schemas#another-library).

Bindings for outside stores follow the same rule. `zustand()` comes from
`@lunarhue/forms-bind/zustand` and `signal()` for a Solid signal from
`@lunarhue/forms-bind/solid`, not from core. A binding never replaces the
form's store. It is a two-way copy of the value, set up per form, so two forms
can bind to two different stores.

### Writing your own

`definePlugin` gives you hooks for writes, resets and submit, your own slot for
field and form state, and an API that shows up typed at `form.plugins.<name>`.
A plugin can also take parts: config for one field type, fieldset or form,
as in `field(PhoneInput, masked({ clean: digits }))`. A form that uses a field
type without the plugin its parts need is a type error.
Plugins can't step on each other: a write made inside a hook is queued, and
each plugin sees the records frozen. A plugin depends on core and never on an
adapter, so it works under React and Solid alike. If you publish one, call it
`forms-plugin-<name>`.

The full rules are in
[Writing a plugin](https://forms.lunarhue.dev/react/plugins/writing-a-plugin), and
every error code is listed on [the errors page](https://forms.lunarhue.dev/errors).

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) covers setup, how work lands, changesets and
the size rules. Report a vulnerability through [SECURITY.md](SECURITY.md).

## Scripts

Run these from the repo root with `bun run <name>`. Each one covers every package.

- `typecheck`: `tsc` over the tooling config files and each package. Packages read
  each other from source, so no build is needed first.
- `lint`: oxlint with type-aware rules, plus the React Compiler rules for
  `packages/react`. Warnings fail it.
- `test`: vitest, runtime tests and `*.test-d.ts` type tests.
- `build`: ESM in `dist/esm` and CJS in `dist/cjs` with tsdown, declarations
  with `tsc`. Packages build in dependency order.
- `check:package`: publint and arethetypeswrong on the packed package. Needs a build.
- `size`: size-limit on each entry point. Needs a build.
- `e2e`: the browser suite in [`e2e`](e2e/README.md), every adapter. Not part
  of the checks above.
- `e2e:changed`: the same suite for the adapters the changes since
  `origin/main` can reach. `--base <ref>` picks another base.
