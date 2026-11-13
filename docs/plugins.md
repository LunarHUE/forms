# Plugins

Every plugin goes in a `plugins` list: on `createForms`, on a form's
definition, or on one form, as `useForm(definition, { plugins })` in React
and `createForm(definition, { plugins })` in Solid. A form's own list is read
once, when the form is made, and its plugins run after the others. Where a
plugin lives depends on one question: does it need someone else's library?

## Three kinds

| Kind        | Needs another library | Lives in                                        | Import from                                    |
| ----------- | --------------------- | ----------------------------------------------- | ---------------------------------------------- |
| First class | No                    | `@lunarhue/forms-core`, one entry per plugin    | your adapter, `<adapter>/plugins/<name>`       |
| Third party | Yes                   | a package in this repo, one entry per library   | that package, such as `@lunarhue/forms-schema` |
| Community   | Up to the author      | the author's own package, `forms-plugin-<name>` | that package                                   |

## First class

These have no dependencies. Core ships each one at its own entry, so
importing one never loads another. Each adapter re-exports every one of
them at the same path, so you import from the adapter you already have:

```ts
import { history } from "@lunarhue/forms-react/plugins/history";
import { validation } from "@lunarhue/forms-react/plugins/validation";
```

The Solid adapter has the same paths under `@lunarhue/forms-solid`. Without
an adapter, import from `@lunarhue/forms-core/plugins/<name>`.

- `validation`: the validation runner alone, for function validators and for
  a Standard Schema of a library with no schema plugin. Schema plugins bring
  it, so a form with one doesn't need it.
- `history`: undo and redo of the user's value and array writes, one step
  per task.
- `mask`: cleans the value written at named fields before the store takes it,
  with `digits` and `upper` as ready-made cleaners.
- `rules`: sets `disabled` and a `hidden` meta flag on named fields from the
  form value, after every write.
- `persist`: saves the form value to storage such as `localStorage` and
  restores it when the store is made. The server has no storage, so the
  restore is a write made after the store starts, not its starting value.
  A server render and the render that hydrates show the defaults, and the
  restored value shows in the render after.
- `rebase`: moves a subtree's baseline to an incoming value, such as a fresh
  server copy, and lets you pick what each changed field keeps.
- `bind`: keeps the form value in step with a store the app owns, given as
  `get`, `set` and `subscribe`. A form write calls `set` once per batch, and
  an outside change is written into the form. `incoming` picks what an
  outside change does: `"replace"` writes over the form, `"rebase"` moves
  the baseline and keeps what the user edited. A form has one binding.

The form's state never moves into the bound store. The form keeps its own
store with errors, touched, dirty, disabled and the rest, and only the value
is copied both ways. The binding listens to the outside store while the form
has listeners, so a form a render made and threw away holds no listener
there. With `initial: "outside"`, the default, the form starts from the
outside value, on the server too. The server HTML shows it, and hydrating
renders once. The definition's `defaultValues` still set the value type,
but the form never shows them.

To write your own hook plugin, use `definePlugin` from `<adapter>/plugins`.

## Writing a plugin

A plugin's `setup` runs once per store and returns its hooks. Writes go
through `ctx.write`, which runs after every plugin in the round has run.
Their records have `cause: { plugin: name }`. A plugin that moves the
baseline to a value from outside, as `rebase` does, can pass `"rebase"`
instead: `ctx.write(fn, "rebase")`. Those are the only two causes a plugin
gets. `"user"` and `"reset"` belong to the form.

Writes that aren't user edits rerun the validators that already run on the
paths they change. A plugin that writes many paths in one `ctx.write` reruns
each validator once, after the last write, so a form validator over those
paths runs once and an async one isn't restarted.

A plugin can give the form its starting value with `initial`. It runs
before the store is made, gets the value the store would start from, and
returns the value to start from instead, or undefined to keep it:

```ts
// Starts the form from a value the server and the client both have.
const startFrom = (value: Profile) => definePlugin({ name: "start", initial: () => value, setup: () => ({}) });
```

The store, its baseline and its server snapshot all start from that value.
Nothing is written, so the form isn't dirty and no plugin sees a record.
When several plugins have `initial`, each gets the value the one before
returned, so the last one in the list wins. The value replaces the store's
starting value whole. It isn't merged with a schema plugin's defaults the
way `defaultValues` is, though `initial` gets those merged defaults and can
merge into them itself. A value that differs between server and client,
such as one read from browser storage, makes hydration fail, so read those
in `setup` and write them with `ctx.write`, as `persist` does.

## Third party

A plugin that needs another library lives in its own package in this repo,
with one entry per library. The library is an optional peer dependency, so
you install only the ones you use. Adapters don't re-export these.

The schema plugins are in `@lunarhue/forms-schema`. They give their
library's schemas default values and bring the validation runner.

```ts
import { valibot } from "@lunarhue/forms-schema/valibot";
import { zod } from "@lunarhue/forms-schema/zod";
```

The bindings to state libraries are in `@lunarhue/forms-bind`. Each one
returns `bind` set up for its library.

```ts
import { zustand } from "@lunarhue/forms-bind/zustand";

// The whole state is the form value.
const form = useForm(profile, { plugins: [zustand(useProfileStore)] });

// One slice of it.
zustand(useAppStore, { select: (state) => state.profile, update: (profile) => ({ profile }) });
```

`zustand` takes the hook `create` returns or a vanilla store. A form write
merges the value into the state with `setState`, so bind the whole state
only when the store has no actions. On a form's own `plugins`, the store's
type must be the form's value type. On `createForms` and on a definition it
isn't checked.

`@lunarhue/forms-schema` and `@lunarhue/forms-bind` take
`@lunarhue/forms-core` as a peer dependency.
A plugin runs on the core copy it was made with, so the app must have one
copy of core. In development, a store whose plugins come from two copies
logs a warning.

## Community

Anyone can publish a plugin. Name the package `forms-plugin-<name>` and build
it with `definePlugin` from `@lunarhue/forms-core/plugins`, with core as a
peer dependency. We may list community plugins, but a listing doesn't mean we
reviewed the code.

## Plugins in a shared component

A form's `plugins` member holds the API of each plugin it has. A component
shared by many forms, such as an undo button, can't name one definition.
Pass the object `createForms` returned to `useFormContext` instead. It returns
the nearest form above that one of its definitions made, and skips forms from
other `createForms` calls:

```tsx
export const forms = createForms({ plugins: [valibot(), history()], fields: { TextField } });

function UndoButton() {
  const form = useFormContext(forms);
  return (
    <button type="button" onClick={() => form.plugins.history.undo()}>
      Undo
    </button>
  );
}
```

The form's type knows the shared plugins, the error type and the registered
field components, so `form.plugins.history`, the `validate` prop and
`form.TextField` all type check. Its value type is unknown, and plugins
added by a definition or by one form are not in its type. To pass this form
as a prop, type it `FormOf<typeof forms>`. Solid's `useFormContext` works the
same way. It throws when no form of those forms is above.
