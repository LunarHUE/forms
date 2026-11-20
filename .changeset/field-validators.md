---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

A definition's validators go through two functions: `validate.fields` takes `fieldValidators({...})` and `validate.form` takes `formValidator(check)`. Core and both adapters export them. A form that uses neither doesn't ship the code that walks a validator tree or reads an `ErrorMap`. `validate.on` is gone: wrap a check in `validateOn(check, timing)`, or set `validate` on `createForms` for every form.

```ts
// Before
validate: {
  on: "input",
  fields: { username: checkName },
  form: checkOrder,
}

// After
validate: {
  fields: fieldValidators({ username: validateOn(checkName, "input") }),
  form: formValidator(validateOn(checkOrder, "input")),
}
```

Written inline in `define`, both take the form's value type, with a schema plugin's `Draft` where there is one. Defined on their own, they need it as a type argument: `fieldValidators<Order>({...})`. A schema passed to `formValidator` alone types the set by its input.
