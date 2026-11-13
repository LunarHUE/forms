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
  per task. It keeps `canUndo` and `canRedo` in its form meta, so an undo
  button can re-render. See below.
- `mask`: cleans the value written at named fields before the store takes it,
  with `digits` and `upper` as ready-made cleaners. See below.
- `rules`: sets `disabled` and a `hidden` meta flag on named fields from the
  form value, when the store is made and after every write. What it sets
  when the store is made is in the server HTML, so a field a rule disables
  or hides renders that way on the server and hydrates with no second render.
- `persist`: saves the form value to storage and restores it when the store
  first gets a listener, as when a component mounts a field.
  `persist("draft")` uses `localStorage`, and `persist("draft",
  sessionStorage)` uses the storage you pass. The server never listens, so
  the restore is a write made after the store starts, not its starting
  value. A server render and the render that hydrates show the defaults, and
  the restored value shows in the render after. Storage that throws, as when
  it is blocked or full, never breaks the form: a failed save is dropped and
  the next write tries again. A saved value that doesn't parse is removed,
  and the form starts from its defaults. To turn saving off, leave `persist`
  out of the list. Passing `undefined` still means `localStorage`.
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

`form.plugins.history` has `undo` and `redo`. Whether either has a step is
form meta, read with the plugin's own `formMeta` reader, so keep the object
`history()` returns:

```tsx
const undoHistory = history();
const forms = createForms({ plugins: [undoHistory] });

// Inside a component with a form of those forms.
<form.State select={(snapshot) => undoHistory.formMeta(snapshot)?.canUndo ?? false}>
  {(canUndo) => (
    <button type="button" disabled={!canUndo} onClick={() => form.plugins.history.undo()}>
      Undo
    </button>
  )}
</form.State>;
```

In Solid, read `undoHistory.formMeta(form.state)?.canUndo` in JSX. The meta
is undefined until a flag first changes, which means both are false. The
flags change in the same render as an undo, a redo or a reset. After an
edit they change a microtask later, when `history` records the step.

### What history can't do

Undoing a remove puts the row back with a new key. Core never brings a
removed key back, so the row's per-field state starts fresh: touched,
edited and errors are gone, and a component keyed by the old key mounts
again. Undoing an insert or a move keeps the keys of the rows that stay, and
their state with them.

`history` records user writes only. A plugin's writes, resets and rebases
make no step. A plugin that writes to the store directly, outside
`ctx.write`, makes a user write, so it does make a step. See "Writes after
an `await`" below.

### Masks

`mask` takes a map from a dotted stable path to a cleaner. A `*` segment
matches every array item or object key:

```ts
mask({ phone: digits, "address.zip": upper, "lines.*.sku": upper });
```

It cleans every value that reaches a named field, whatever wrote it:

- A write above a field, such as `setValue` on `address`, a root replace
  from `bind`, or a row that `push` or `insert` adds, is cleaned at each
  named field below it.
- The form's starting value is cleaned through `initial`, so the baseline is
  clean, the form doesn't start dirty, and a reset leaves it clean. When
  another plugin's `initial` sets the starting value, as `bind` does, put
  `mask` after it in the list.
- User edits, resets and other plugins' writes are cleaned. A value
  `persist` restores is a plugin write, so it comes out clean.
- Rebases aren't. The incoming value is the server's copy, and the baseline
  moves to it as it came. Cleaning it would make the form dirty against its
  own baseline.

To write your own hook plugin, use `definePlugin` from `<adapter>/plugins`.

## Writing a plugin

A plugin's `setup` runs once per store and returns its hooks. Writes go
through `ctx.write`, which runs after every plugin in the round has run.
Their records have `cause: { plugin: name }`. A plugin that moves the
baseline to a value from outside, as `rebase` does, can pass `"rebase"`
instead: `ctx.write(fn, "rebase")`. Those are the only two causes a plugin
gets. `"user"` and `"reset"` belong to the form. The host passes every
write to every plugin with its cause, and each plugin decides what to do
with it, as `mask` skips rebases.

### Setup

Setup runs when the store is made, before anything reads it, on the server
and on the client alike. What it writes, values, flags and meta, is part of
the store's starting state:

- The server snapshot shows it, so the server HTML and the first render on
  the client agree, and hydrating renders once. This is how `rules` puts
  `disabled` and `hidden` in the server HTML.
- It makes no write records, so no plugin's `onWrite` sees it and no
  `deferred` or `idle` delivery is scheduled. A store that is made and never
  written to, as on the server, starts no timer.
- It doesn't move the baseline. A value written in setup is dirty against
  the defaults, on the server and the client alike. To start from a value
  without making the form dirty, use `initial`.

So setup must give the same result on the server and the client. Anything
that reads the browser or the environment, such as storage, goes in
`onActive`, which runs when the store gets its first listener. The server
never listens, so it never runs there. `persist` restores in `onActive`.

### Writes

`beforeWrite` runs before each value write, in plugin order, and returns the
value to write or `refuse` to stop it. A write of an object comes through
once, at the object's path, so a plugin that cares about a field below
walks down to it, as `mask` does. A row that `push` or `insert` adds comes
through as a write at the row's path, with `before` undefined. The row is
already in the array by then, since the insert makes its key. Return a
replacement row, or `refuse` to take the row out again. A form with no
`beforeWrite` plugin skips all of this.

### Writes after an `await`

Code after an `await` runs once the hook has returned, so the host can't
tell its writes from the user's. A write made straight to the store there
is recorded as a user edit: the field is marked edited and `history` makes
an undo step from it. Write through `ctx.write`, and pass `edited: false`
when the value isn't the user's:

```ts
async onSubmit() {
  const token = await fetchToken();
  // Wrong: a user edit, with an undo step.
  ctx.store.root.at("token").setValue(token);
  // Right: a plugin write, not marked edited.
  ctx.write(() => ctx.store.root.at("token").setValue(token, { edited: false }));
}
```

### Refusing a submit

A throw or a rejected promise in `onSubmit` is a bug. It goes to
`onPluginError` and the submit carries on. To stop a submit on purpose,
return `refuse`, directly or from the promise. The definition's `onSubmit`
isn't called, and the submission ends `"invalid"`, as it does when
validation fails, and `onSubmitted` gets it. Set a form error first so the
user sees why:

```ts
import { definePlugin, refuse } from "@lunarhue/forms-react/plugins";

const captcha = definePlugin({
  name: "captcha",
  setup: (ctx) => ({
    async onSubmit() {
      try {
        const token = await fetchToken();
        ctx.write(() => ctx.store.root.at("token").setValue(token, { edited: false }));
        return undefined;
      } catch {
        ctx.store.root.setErrors({ message: "We couldn't check the form. Try again." });
        return refuse;
      }
    },
  }),
});
```

`refuse` returned directly stops the plugins after this one from running
their `onSubmit`. Returned from a promise it can't, since every `onSubmit`
started when the submit did. A plugin doesn't know the form's error type,
so the error it sets must fit the form's `mapError`, if it has one.

### Validation and starting values

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
in `onActive` and write them with `ctx.write`, as `persist` does.

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
