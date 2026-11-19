---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
"@lunarhue/forms-schema": minor
---

Validation is built into core again. A form with no plugins can take `validate` on its definition and a `validate` prop on a field, and `field.validate()` and `registerValidator` work instead of throwing.

`validation()` is gone, along with the `plugins/validation` entry of core, React and Solid. Drop it from your `plugins` list. `defineSchemaPlugin` moved to `@lunarhue/forms-core/plugins`. Schema plugins such as `valibot()` and `zod()` now only give a schema's default values. A schema whose library has no plugin installed still needs complete `defaultValues`, and leaving them out is a type error that names `NoSchemaPlugin`.

Removed types: `IfValidation`, `HasValidation`, `ValidationNotInstalled`, `SchemaNeedsValidation`, `ValidationPlugin`, and `ValidatePropFor` in the adapters. `Scope` and `Fieldset` in the adapters lose their plugin type parameter, and so do the bound component types under them. The `validation:definition` and `validation:validator` errors are gone.

The main entry of core grows by about 1.9 kB brotli, since it now carries the runner.
