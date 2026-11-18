---
"@lunarhue/forms-core": patch
---

In a form without a schema, `onSubmit` now gets a copy of the form value that it may change, in development and production alike. Sorting or pushing to an array in `onSubmit` no longer throws in development, and it leaves the form's own value as it was.
