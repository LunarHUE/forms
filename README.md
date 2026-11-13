# forms

A form library that doesn't depend on any UI framework. The core holds the form
logic, and small adapters connect it to each framework or schema library.

| Package                  | What it is                                                |
| ------------------------ | --------------------------------------------------------- |
| `@lunarhue/forms-core`   | Framework-independent core                                |
| `@lunarhue/forms-react`  | React adapter (React 16.8 and later)                      |
| `@lunarhue/forms-solid`  | Solid adapter: Solid 2 at `.`, Solid 1 at `./v1`          |
| `@lunarhue/forms-vue`    | Vue 3 adapter                                             |
| `@lunarhue/forms-schema` | Schema adapters: Valibot at `./valibot`, Zod 4 at `./zod` |

Nothing is published yet.

## What it looks like

A profile form in React. It validates with Zod, keeps its values in a Zustand
store, reuses an address fieldset, and merges a fresh server copy without
losing what the user typed.

This is the API the library is being built toward. The plugin list, `rebase()`
as a plugin and the Zustand binding are in open pull requests and issues, not
on `main` yet.

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

`name="emial"` is a compile error. So is `schema` or `validate` with no
validation plugin in the list.

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
