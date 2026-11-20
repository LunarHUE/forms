---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

`errorsByKind(handle)`, a new core function the adapters re-export, returns a field's validation errors grouped by the kind of validator that set them: `{ schema, form, field }`. `schema` holds the definition's schema errors, `form` the errors from `validate.form`, and `field` those from `validate.fields` and `registerValidator`, in the order they were added. A thrown validator's error goes under its validator's kind. Errors from `setErrors` aren't included, since the snapshot's `userErrors` has them. It is a read, not a subscription, and a standalone function rather than a store method, so a form that never calls it doesn't ship it. The new `ErrorsByKind<E>` and `ValidatorKind` types name the result and its keys.
