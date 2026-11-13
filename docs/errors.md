# Errors

In development every error is a sentence that says what went wrong. A
production build drops those sentences to save bytes, so core's errors
come out as the package name and a short code:

```
@lunarhue/forms-core: plugins:loop
```

Look the code up here. The adapters still throw their full sentences in
production, so they are listed by message.

## Core

These come from `@lunarhue/forms-core`. The adapters use core, so a React,
Solid or Vue app gets them too.

| Code                  | Where it shows up                    | What causes it                                                                                                                         | What to do                                                                                                                                                |
| --------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins:name`        | Thrown when the store is made        | Two hook plugins in one store have the same name. The lists on `createForms`, on the definition and on the form all count.             | Install the plugin once. To run two masks side by side, give one a `name`. A form has one `bind`.                                                         |
| `plugins:cycle`       | Thrown when the store is made        | The plugins' `after` lists make a loop, such as `a` after `b` and `b` after `a`.                                                       | Remove a name from one of the `after` lists.                                                                                                              |
| `plugins:write`       | Sent to `onPluginError`              | A plugin wrote to the store directly while one of its hooks was running, `setup` included.                                             | Write inside `ctx.write`. The write then runs once every plugin in the round has run.                                                                     |
| `plugins:loop`        | Sent to `onPluginError`              | Plugins kept answering each other's writes for 10 rounds in one batch. The writes still waiting are dropped.                          | Make a plugin skip writes it caused, by checking `record.cause`, or write only when the value would change.                                               |
| `validation:definition` | Thrown when the store is made      | The definition has `validate` or `schema`, but no plugin brings the validation runner.                                                 | Add `validation()` from `<adapter>/plugins/validation`, or a schema plugin such as `valibot()`, to `plugins`.                                              |
| `validation:validator`  | Thrown when the validator is added | A validator was added to a field, through `registerValidator`, `useValidator` or a `validate` prop, and no plugin brings the runner. | Same as `validation:definition`.                                                                                                                          |
| `schema:defaults`     | Thrown when the store is made        | The definition has a `schema` from a library with no schema plugin installed, and no `defaultValues`.                                  | Install that library's schema plugin, such as `valibot()` or `zod()`. For a library with none, such as arktype, give complete `defaultValues`.             |
| `rebase:store`        | Thrown by `form.plugins.rebase`      | The handle passed to `rebase` belongs to another store. This one is a `TypeError`.                                                    | Pass a handle of the form the `rebase` plugin is installed on.                                                                                            |

`onPluginError` is an option of `createForms`. Without it, an error sent
there is thrown on a later task, so it reaches the page's error handler
without breaking the write that was running.

## React

`@lunarhue/forms-react` throws these sentences in production too.

| Message starts with                                                    | What causes it                                                                           | What to do                                                                       |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `useForm takes a definition from forms.define.`                        | `useForm` got something that `define` didn't return.                                     | Pass the definition `forms.define(...)` returned.                                |
| `no form.Form is mounted above this component.`                        | `useFormContext()` found no form above it.                                               | Render the component inside `form.Form`, or pass the form down as a prop.        |
| `no form.Form of these forms is mounted above this component.`         | `useFormContext(forms)` found no form made from one of those forms' definitions.         | Render it inside the `form.Form` of a form made from one of their definitions.   |
| `no form.Form of this definition is mounted above this component.`     | `useFormContext(definition)` found no form made from that definition.                    | Render it inside the `form.Form` of a form made from that definition.            |

## Solid

`@lunarhue/forms-solid` throws these sentences in production too.

| Message starts with                                     | What causes it                                                                    | What to do                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| give a bound component a `name` or a `handle`.          | A bound component, such as `form.TextField`, got neither `name` nor `handle`.     | Pass `name`, or a `handle`.                                                             |
| `useFormContext() found no form.`                       | `useFormContext()` found no form above it.                                        | Render it inside the form's `form.Form`.                                                |
| `useFormContext(forms) found no form made from those forms.` | `useFormContext(forms)` found no form from those forms' definitions.         | Render it inside the `form.Form` of a form made from one of their definitions.          |
| `useFormContext(definition) found no form made from that definition.` | `useFormContext(definition)` found no form from that definition.     | Render it inside the `form.Form` of a form made by `createForm(definition)`.            |

The Vue adapter, `@lunarhue/forms-schema` and `@lunarhue/forms-bind` throw
no errors of their own.

## Warnings

These are logged in development only, and production drops them.

- `This store's plugins come from two copies of @lunarhue/forms-core.` The
  app bundles two copies of core, and plugins only work with the copy they
  were made with. Install one copy, as by deduping the lockfile.
- `@lunarhue/forms-react: a form was server rendered without an id.` React
  16.8 and 17 have no `useId`, so the generated id can't match on the
  client. Pass `id` to `useForm`.
