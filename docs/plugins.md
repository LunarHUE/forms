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
import { dirty } from "@lunarhue/forms-react/plugins/dirty";
import { history } from "@lunarhue/forms-react/plugins/history";
import { validation } from "@lunarhue/forms-react/plugins/validation";
```

The Solid adapter has the same paths under `@lunarhue/forms-solid`. Without
an adapter, import from `@lunarhue/forms-core/plugins/<name>`.

- `validation`: the validation runner alone, for function validators and for
  a Standard Schema of a library with no schema plugin. Schema plugins bring
  it, so a form with one doesn't need it.
- `dirty`: dirty tracking. Each field and the form get `dirty`, true when
  the value differs from its baseline, `store.changes()` lists the fields
  that differ, and a definition or `createForms` can take an `equals`
  comparison. Without it `dirty` is always false, `changes()` is empty and
  `equals` is a type error. In development, the first call to `changes()`
  on such a form logs the warning [`dirty:untracked`](errors.md). Reading
  `dirty` doesn't warn. Reset still goes back to the baseline, and
  `rebase` and `bind` still move it, since core keeps the baseline either
  way. Without `dirty`, `rebase` compares values by reference alone, so a
  date with the same time counts as changed and goes to your `resolve`.
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
<form.State select={(snapshot) => undoHistory.formMeta(snapshot).canUndo}>
  {(canUndo) => (
    <button type="button" disabled={!canUndo} onClick={() => form.plugins.history.undo()}>
      Undo
    </button>
  )}
</form.State>;
```

In Solid, read `undoHistory.formMeta(form.state).canUndo` in JSX. Both
flags are false before the first step, on the server too. They change in
the same render as an undo, a redo or a reset. After an edit they change a
microtask later, when `history` records the step.

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

### Rules

`rules` takes a map from a field's dotted name, the same name a `name` prop
takes, to a rule. Each rule gets the whole form value and returns the
field's `disabled` and `hidden` flags. Name the form's value type:

```ts
interface Delivery {
  pickup: boolean;
  gift: boolean;
  address: { street: string; city: string };
  message: string;
}

const deliveryRules = rules<Delivery>({
  address: (value) => ({ disabled: value.pickup }),
  message: (value) => ({ hidden: !value.gift }),
});

const delivery = forms.define({ defaultValues, plugins: [deliveryRules] });
```

The compiler checks both ends. A name that isn't a field of `Delivery`,
such as `"adress"`, is a type error, and so is putting `deliveryRules` on a
form whose value isn't a `Delivery`, in a definition's `plugins` or a
store's own. Leaving out the type is an error too, since there would be
nothing to check the names against. A form may have fields `Delivery`
doesn't name. Names go through objects only, so a rule can't name an array
item. Give the array a rule, or the object around it.

`rules` can't take the type from the definition it sits in. TypeScript
works out a call such as `rules({ ... })` before it knows the form's value
type, even when the call is written inside `plugins`.

Read `hidden` with the plugin's own reader, `deliveryRules.meta(field).hidden`.
A field no rule hides reads `{ hidden: false }`, so the reader never
returns undefined.

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

### Meta

`ctx.setMeta` and `ctx.setFormMeta` write the plugin's own slot on a field
or on the form. Annotate `setup`'s parameter as `PluginContext<M, F>` to
type them, and read them back with the plugin's `meta` and `formMeta`
readers. Both return undefined until the plugin sets something.

When the meta has a sensible value before then, give it as `initialMeta`
for fields or `initialFormMeta` for the form. The reader returns it until
the plugin sets its own, and its type drops `undefined`. The reader works it
out from the snapshot alone, so the server and the first client render read
the same value. `history` starts from `{ canUndo: false, canRedo: false }`
this way:

```ts
definePlugin({
  name: "history",
  initialFormMeta: { canUndo: false, canRedo: false },
  setup(ctx: PluginContext<never, HistoryMeta>) {
    // ...
  },
});
```

Every field shares the one `initialMeta` value. Freeze it and keep it in
one place, so a selector that returns it gets the same object each time.
`rules` starts every field as shown:

```ts
const shown: RulesMeta = Object.freeze({ hidden: false });

definePlugin({
  name: "rules",
  initialMeta: shown,
  setup(ctx: PluginContext<RulesMeta>) {
    // ...
  },
});
```

The plugin's type says which readers can return undefined. `definePlugin`
returns a `HookPlugin<A, N, M, F, MU, FU>`, where `MU` and `FU` are
`undefined` by default and `never` when the definition gives `initialMeta`
or `initialFormMeta`. `history()` is a
`HookPlugin<HistoryApi, "history", never, HistoryMeta, undefined, never>`.

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

`signal` binds a Solid 2 signal. Pass the getter and setter `createSignal`
returns:

```ts
import { signal } from "@lunarhue/forms-bind/solid";

const [settings, setSettings] = createSignal({ displayName: "Ada", timezone: "Europe/London" });
const form = createForm(settingsForm, { plugins: [signal(settings, setSettings)] });
```

A form write sets the signal. A change to the signal reaches the form when
Solid runs its effects. The binding makes the effect that watches the signal
in a root of its own when the form gets its first listener, and disposes it
when the form loses its last, so you write no `createRoot` or `createEffect`.
On the server no effect runs. The signal's type is checked against the form's
value type the same way as with `zustand`.

`@lunarhue/forms-schema` and `@lunarhue/forms-bind` take
`@lunarhue/forms-core` as a peer dependency.
A plugin runs on the core copy it was made with, so the app must have one
copy of core. In development, a store whose plugins come from two copies
logs a warning.

## Community

Anyone can publish a plugin. Name the package `forms-plugin-<name>` and build
it with `definePlugin` from `@lunarhue/forms-core/plugins`. We may list
community plugins, but a listing doesn't mean we reviewed the code.

A plugin takes `@lunarhue/forms-core` as a peer dependency and never imports
an adapter. Every adapter wraps the same core store, so a plugin written
against core works under React, Solid and any adapter to come. One that
imports `@lunarhue/forms-react` only works in React apps.

```json
{
  "name": "forms-plugin-trim",
  "peerDependencies": { "@lunarhue/forms-core": "^1.0.0" },
  "devDependencies": { "@lunarhue/forms-core": "^1.0.0" }
}
```

The dev dependency gives your own tests a copy of core.

### Testing a plugin

Test against core too, with `testStore` from
`@lunarhue/forms-core/plugins/testing`. It makes a store from a form
definition with your plugin in its `plugins`, records what each timing
delivers, and collects what your hooks throw. It imports no test runner, so
it works with Vitest, Jest, `node:test` or Bun's runner. Its entry is apart
from the others, so it never ends up in an app bundle.

```ts
import { definePlugin } from "@lunarhue/forms-core/plugins";
import { testStore } from "@lunarhue/forms-core/plugins/testing";
import { expect, it } from "vitest";

// Trims the ends of every string written at `fields`.
const trim = (...fields: string[]) =>
  definePlugin({
    name: "trim",
    setup: () => ({
      beforeWrite: (write) =>
        typeof write.value === "string" && fields.includes(write.path.join(".")) ? write.value.trim() : write.value,
    }),
  });

it("trims the fields it names", () => {
  const { store, records, errors } = testStore({ defaultValues: { name: "", note: "" }, plugins: [trim("name")] });
  store.root.at("name").setValue("  Ada ");
  store.root.at("note").setValue(" hi ");
  expect(store.root.peek().value).toEqual({ name: "Ada", note: " hi " });
  expect(records.sync[0]).toMatchObject({ path: ["name"], after: "Ada", cause: "user" });
  expect(errors).toEqual([]);
});
```

`testStore` takes what `define` takes, `defaultValues` or a `schema`,
`validate`, `onSubmit` and the rest, with the plugins under test in
`plugins`. Put `dirty()`, `validation()` or a schema plugin there too when
the test needs them. It returns:

- `store`: the store, typed as an app's would be, so `store.plugins.<name>`
  has your plugin's API. Drive it as an app would: `store.root.at("name")`
  writes, `store.submit()` runs `onSubmit` and `onSubmitted`, and
  `store.reset()` or a field's `reset()` runs `onReset`.
- `records`: the write records each timing delivered, as `records.sync`,
  `records.deferred` and `records.idle`. Three recording plugins run after
  yours to fill them. Empty one with `records.sync.length = 0`.
- `errors`: what plugin hooks threw, as `{ plugin, error }`. Nothing is
  rethrown, so end a test with `expect(errors).toEqual([])`.
- `flush()`: delivers the waiting `deferred` and `idle` records now, with no
  timers, real or fake. A `deferred` delivery also comes on its own after
  `await Promise.resolve()`, as it does in an app.
- `listen()`: gives the store a listener, as a mounted component does, so
  `onActive` runs. Call the function it returns to remove the listener and
  run the cleanup.
- `server()`: the server snapshots, as `{ form, fields }`, with `fields`
  keyed by each field's dotted name and the root under `""`. Setup must give
  the same result on the server and the client, so check it with
  `expect(testStore(config).server()).toEqual(testStore(config).server())`.

`testStore` runs no framework. To see your plugin in a rendered React or
Solid form, test it there as well.

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
