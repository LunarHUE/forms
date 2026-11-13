# Plugins

Every plugin goes in one `plugins` list, on `createForms` or on a form's
definition. Where a plugin lives depends on one question: does it need
someone else's library?

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
  restores it when the store is made.
- `rebase`: moves a subtree's baseline to an incoming value, such as a fresh
  server copy, and lets you pick what each changed field keeps.

To write your own hook plugin, use `definePlugin` from `<adapter>/plugins`.

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

`@lunarhue/forms-schema` takes `@lunarhue/forms-core` as a peer dependency.
A plugin runs on the core copy it was made with, so the app must have one
copy of core. In development, a store whose plugins come from two copies
logs a warning.

## Community

Anyone can publish a plugin. Name the package `forms-plugin-<name>` and build
it with `definePlugin` from `@lunarhue/forms-core/plugins`, with core as a
peer dependency. We may list community plugins, but a listing doesn't mean we
reviewed the code.
