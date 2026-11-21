---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
---

New experimental entries, `@lunarhue/forms-core/mini` and `@lunarhue/forms-react/mini`, for small forms such as a search box or a login. A search form on `/mini` is about 2.6 kB brotli with React external, against about 11 kB on the main entry. Expect breaking changes in minor releases while it is experimental.

`/mini` keeps `createForms().define()`, `useForm`, `form.Form`, `form.Field`, `form.State`, `inputProps`, `fieldValidators`, Standard Schema validation, `setErrors`, `reset` and the `transform`, `text` and `observe` parts, pinned at a field with `forms.fieldset(...parts).at(name)`. Every member has the same name and call as in the main entry, and its types are a subset of the main entry's, so a form moves up by changing the import. Validators run sync, on blur and on submit, then on each change once the field was blurred, has an error, or the form was submitted.

It leaves out async validation, plugins, arrays, object fields in `form.Field`, dirty state, meta, native mode and devtools. Passing a plugin or a plugin's part to its `define` is a type error.

By default a `/mini` form wakes every listener on each change, which is the least code. `createForms({ subscribe: perField() })` wakes only the fields that changed, for about 220 B more. The main entry takes the same option and ignores it, since it always wakes per field.
