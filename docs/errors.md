# Errors

Every error and warning the packages raise has a code, written `area:name`.
In development the message is a sentence that says what went wrong,
followed by a link to the code's entry on this page:

```
@lunarhue/forms-core: Two plugins are named "email". https://forms.lunarhue.dev/errors#core:plugins:name
```

A production build drops the sentence to save bytes and keeps the code and
the link:

```
@lunarhue/forms-react: context:form https://forms.lunarhue.dev/errors#react:context:form
```

Core's production messages leave the link out, since it would cost about
22 B in every core entry point. When a sentence names something, such as a
plugin, the name comes after the code:

```
@lunarhue/forms-core: plugins:name email
```

Each entry below has the sentence, with the named value in angle brackets,
so a production message can be read back from its code. The anchor of an
entry is the package and the code, as in `#react:context:form`.

The links point at a placeholder address until the docs have a site. Each
package keeps it in one constant, `docs` in its `src/problem.ts`.

The Vue adapter, `@lunarhue/forms-schema` and `@lunarhue/forms-bind` raise
no errors of their own.

## Core

These come from `@lunarhue/forms-core`. The adapters use core, so a React,
Solid or Vue app gets them too.

`onPluginError` is an option of `createForms`. Without it, an error sent
there is thrown on a later task, so it reaches the page's error handler
without breaking the write that was running.

<a id="core:plugins:name"></a>

### `plugins:name`

> Two plugins are named "&lt;name&gt;".

Thrown when the store is made. Two hook plugins in one store have the same
name. The lists on `createForms`, on the definition and on the form all
count. Install the plugin once. To run two masks side by side, give one a
`name`. A form has one `bind`.

<a id="core:plugins:cycle"></a>

### `plugins:cycle`

> Plugin "&lt;name&gt;" is part of an `after` cycle.

Thrown when the store is made. The plugins' `after` lists make a loop, such
as `a` after `b` and `b` after `a`. Remove a name from one of the `after`
lists.

<a id="core:plugins:write"></a>

### `plugins:write`

> A plugin wrote to the store from inside a hook. Write through `ctx.write`.

Sent to `onPluginError`. A plugin wrote to the store directly while one of
its hooks was running, `setup` included. Write inside `ctx.write`. The write
then runs once every plugin in the round has run.

<a id="core:plugins:loop"></a>

### `plugins:loop`

> Plugins kept answering each other's writes for 10 rounds: &lt;names&gt;.

Sent to `onPluginError`. Plugins kept answering each other's writes for 10
rounds in one batch, and the writes still waiting are dropped. The value is
the names of the plugins still writing. Make a plugin skip writes it caused,
by checking `record.cause`, or write only when the value would change.

<a id="core:plugins:copies"></a>

### `plugins:copies`

> This store's plugins come from two copies of @lunarhue/forms-core. Install one copy.

A warning, logged in development only. The app bundles two copies of core,
and plugins only work with the copy they were made with. Install one copy,
as by deduping the lockfile.

<a id="core:validation:definition"></a>

### `validation:definition`

> This form's definition has `validate` or `schema`, but no plugin brings the validation runner. Add `validation()` from "@lunarhue/forms-core/plugins/validation", or a schema plugin such as `valibot()`, to `plugins`.

Thrown when the store is made. Add `validation()` from
`<adapter>/plugins/validation`, or a schema plugin such as `valibot()`, to
`plugins`.

<a id="core:validation:validator"></a>

### `validation:validator`

> A validator was added to a field (through `registerValidator`, `useValidator` or a `validate` prop), but no plugin brings the validation runner. Add `validation()` from "@lunarhue/forms-core/plugins/validation", or a schema plugin such as `valibot()`, to `plugins`.

Thrown when the validator is added. The fix is the same as for
`validation:definition`.

<a id="core:schema:defaults"></a>

### `schema:defaults`

> No schema plugin for vendor "&lt;vendor&gt;", so the definition needs defaultValues.

Thrown when the store is made. The definition has a `schema` from a library
with no schema plugin installed, and no `defaultValues`. Install that
library's schema plugin, such as `valibot()` or `zod()`. For a library with
none, such as arktype, give complete `defaultValues`.

<a id="core:rebase:store"></a>

### `rebase:store`

> rebase: the handle belongs to another store.

Thrown by `form.plugins.rebase`, as a `TypeError`. The handle passed to
`rebase` belongs to another store. Pass a handle of the form the `rebase`
plugin is installed on.

## React

These come from `@lunarhue/forms-react`.

<a id="react:form:definition"></a>

### `form:definition`

> useForm takes a definition from forms.define.

`useForm` got something that `define` didn't return. Pass the definition
`forms.define(...)` returned.

<a id="react:context:form"></a>

### `context:form`

> no form.Form is mounted above this component. Render it inside form.Form, or pass the form down as a prop.

`useFormContext()` found no form above it. Render the component inside
`form.Form`, or pass the form down as a prop.

<a id="react:context:forms"></a>

### `context:forms`

> no form.Form of these forms is mounted above this component. Forms of other createForms calls don't count. Render it inside the form.Form of a form made from one of their definitions.

`useFormContext(forms)` found no form made from one of those forms'
definitions.

<a id="react:context:definition"></a>

### `context:definition`

> no form.Form of this definition is mounted above this component. Forms of other definitions don't count. Render it inside the form.Form of a form made from it.

`useFormContext(definition)` found no form made from that definition.

<a id="react:id:server"></a>

### `id:server`

> a form was server rendered without an `id`. React before 18 has no `useId`, so the generated id can't match on the client. Pass `id` to `useForm`.

A warning, logged in development only, from `@lunarhue/forms-react/legacy`.
React 16.8 and 17 have no `useId`,
so the generated id can't match on the client. Pass `id` to `useForm`.

<a id="react:entry:legacy"></a>

### `entry:legacy`

> React before 18 needs @lunarhue/forms-react/legacy.

An app on React 16.8 or 17 imported `@lunarhue/forms-react`, which needs
React 18. Import from `@lunarhue/forms-react/legacy` instead. It has the
same API.

## Solid

These come from `@lunarhue/forms-solid`.

<a id="solid:field:target"></a>

### `field:target`

> give a bound component a `name` or a `handle`.

A bound component, such as `form.TextField`, got neither `name` nor
`handle`. Pass `name`, or a `handle`.

<a id="solid:context:form"></a>

### `context:form`

> useFormContext() found no form. Render it inside the form's `form.Form`.

`useFormContext()` found no form above it.

<a id="solid:context:forms"></a>

### `context:forms`

> useFormContext(forms) found no form made from those forms. It skips forms of other `createForms` calls. Render it inside the `form.Form` of a form made from one of their definitions.

`useFormContext(forms)` found no form made from one of those forms'
definitions.

<a id="solid:context:definition"></a>

### `context:definition`

> useFormContext(definition) found no form made from that definition. It skips forms of other definitions. Render it inside the `form.Form` of a form made by `createForm(definition)`.

`useFormContext(definition)` found no form made from that definition.
