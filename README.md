# forms

Forms for React, Solid and Vue, with the form logic in one small core that
knows nothing about any of them.

We wrote it because we wanted three things at once: field names the compiler
checks, a bundle well under what the big form libraries ship, and a way to add
features without everyone paying for them. So the core does values, arrays and
submit. Validation, undo, masks and the rest are plugins you install.

Nothing is published yet.

## What it looks like

A profile form in React. Zod validates it, a Zustand store holds its values,
the address is a reusable fieldset, and Refresh pulls the server's copy without
wiping what the user has typed.

Fair warning: this is where the API is headed. The plugin list, `rebase()` as
a plugin and the Zustand binding are still in open pull requests and issues.

```tsx
import { z } from "zod";
import { create } from "zustand";
import {
  createForms,
  useForm,
  useFormContext,
  useFormState,
  type FieldApi,
  type HandleOf,
} from "@lunarhue/forms-react";
import { rebase } from "@lunarhue/forms-react/plugins/rebase";
import { zod } from "@lunarhue/forms-schema/zod";
import { zustand } from "@lunarhue/forms-bind/zustand";

// Your own input, registered once.
interface TextFieldProps {
  field: FieldApi<string>;
  label: string;
}

function TextField({ field, label }: TextFieldProps) {
  return (
    <label>
      {label}
      <input {...field.inputProps()} />
      {field.shownErrors.map((error) => (
        <p key={error.message} id={field.errorId}>
          {error.message}
        </p>
      ))}
    </label>
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

// The form's values live in your zustand store.
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
  plugins: [zustand(useProfileStore)],
  onSubmit: saveProfile,
});

// A reusable group of fields,
// usable under any form with an address.
const AddressFieldset = forms.fieldset(Address);

interface AddressFieldsProps {
  field: HandleOf<typeof AddressFieldset>;
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

export function ProfileForm() {
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

Type `name="emial"` and the build fails. Same if you pass `schema` or
`validate` with no validation plugin in the list.

## Packages

| Package                  | What it is                                       |
| ------------------------ | ------------------------------------------------ |
| `@lunarhue/forms-core`   | The core, plus the plugins that need nothing else |
| `@lunarhue/forms-react`  | React adapter, React 16.8 and later              |
| `@lunarhue/forms-solid`  | Solid adapter: Solid 2 at `.`, Solid 1 at `./v1` |
| `@lunarhue/forms-vue`    | Vue 3 adapter                                    |
| `@lunarhue/forms-schema` | Schema plugins: `./valibot` and `./zod`          |

## Plugins

Everything goes in one list, on `createForms` for every form or on `define`
for one form. A plugin you don't install costs you no bytes.

We sort them by one question: does it need someone else's library?

### First class

No dependencies beyond core. They live in core and each adapter re-exports
them, so you import from the package you already have.

| Plugin         | What it does                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `validation()` | Runs validators and collects errors. Use it alone when you validate by hand, with no schema.   |
| `history()`    | Undo and redo. One step per keystroke or batch, and array rows keep their identity.            |
| `mask()`       | Cleans a value on its way into the store: digits only, upper case, or your own function.       |
| `rules()`      | Works out `disabled` and `hidden` for a field from the rest of the form's value.               |
| `persist()`    | Saves the draft to storage when the page is idle and restores it on load.                      |
| `rebase()`     | Takes a fresh copy of the data and lets you decide, leaf by leaf, whether to keep the user's edit. |
| `bind()`       | Keeps the form's value in a store you own, in both directions.                                 |

### Schema

These work with a schema library, so they sit in `@lunarhue/forms-schema`, one
entry per library. Each brings validation with it, so you don't list
`validation()` as well.

| Plugin      | Import                           | What it does                                           |
| ----------- | -------------------------------- | ------------------------------------------------------ |
| `zod()`     | `@lunarhue/forms-schema/zod`     | Validates with Zod 4 and types the form from the schema. |
| `valibot()` | `@lunarhue/forms-schema/valibot` | The same for Valibot.                                  |

Any other [Standard Schema](https://standardschema.dev) works as `schema` too,
once validation is installed. You give `defaultValues` yourself in that case.

Bindings for outside stores follow the same rule. `zustand()` will ship from
`@lunarhue/forms-bind/zustand`, not from core.

### Where they stand

- Validation, `zod()` and `valibot()` work today, in the open pull request for
  the plugin list.
- `history()`, `mask()`, `rules()` and `persist()` exist as test fixtures that
  prove the plugin hooks. They aren't exported yet.
- `rebase` works today as a plain function and is being moved to a plugin.
- `bind()` and `zustand()` are designed and not built.

### Writing your own

`definePlugin` gives you hooks for writes, resets and submit, your own slot for
field and form state, and an API that shows up typed at `form.plugins.<name>`.
Plugins can't step on each other: a write made inside a hook is queued, and
each plugin sees the records frozen. If you publish one, call it
`forms-plugin-<name>`.

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

## Working on it

In a LunarHUE workspace this repo is checked out at `~/repos/forms` and runs
in its own pod.

- **Shell in the pod:** `ssh forms.<workspace>.repos` from your machine, or
  `ws attach forms` in the workspace.
- **Long-running commands** (dev servers, watchers):
  `ws run forms --name dev --wait-port <port> -- <command>`, then
  `ws ps`, `ws logs forms dev` and `ws stop forms dev`.
- **Dev environment:** `flake.nix` defines it. The pod enters its default
  devShell for every command. Add tools to `packages` there and commit
  `flake.lock`.
- **One-off commands from the parent:**
  `ws-route forms <dir> -- <command>` runs a command in the pod at
  `/workspace/<dir>` (`.` for the root), with the dev environment loaded.
- **Outside Coder:** `.devcontainer/devcontainer.json` opens the repo in the
  same image the pod uses. Run `docker login ghcr.io` first; the image is
  private.
