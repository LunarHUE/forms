---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

Errors from `setErrors` now make a field invalid, and the store can list every invalid field.

`store.invalid()` returns every field with an error, in form order, as `{ field, name, errors }`. The root comes first, with name `""`. `store.subscribeInvalid(listener)` fires when that list may change. `useInvalidFields(form)` in React and `createInvalidFields(form)` in Solid follow it, so an error summary is a few lines. The new `InvalidField<E>` type names an entry.

The field snapshot has a new `userErrors` member, the errors `setErrors` put there. They come last in `errors`, so the validation errors are `errors.slice(0, errors.length - userErrors.length)`.

Breaking changes:

- `snapshot.invalid` is true for a field with only `setErrors` errors. Before, it counted validation errors only. Code that read `invalid` to mean "a validator failed" should check `errors.length > userErrors.length` instead. The form's `valid` hasn't changed, so server errors still don't block the next submit.
- `store.firstInvalid()` and `store.disabledInvalid()` now include fields with only `setErrors` errors. After a server refuses a save, `firstInvalid()` returns the field it named, so the app can focus it. The adapters still don't move focus after `onSubmit` sets errors, because that submit succeeded.
- `DisabledInvalid<E>` is now an alias of `InvalidField<E>`. Its shape is unchanged.
