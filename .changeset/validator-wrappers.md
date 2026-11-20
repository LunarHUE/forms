---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

Validator timing moves from an options object to three wrappers: `debounced(check, ms)`, `validateOn(check, "input" | "blur" | "submit")` and `recheckOnSubmit(check)`. Each takes a validator function or a Standard Schema, returns a check that goes anywhere a bare one does, and nests in any order. The `{ validate, debounce, on, recheckOnSubmit }` object is gone, along with the `ValidatorOptions` and `FormValidatorOptions` types.

```ts
// Before
username: { validate: checkName, debounce: 400, on: "input", recheckOnSubmit: true }

// After
username: recheckOnSubmit(validateOn(debounced(checkName, 400), "input"))
```

The same goes for `validate.form`, the `validate` prop, `useValidator`, `createValidator` and `registerValidator`.

A wrapped schema is a function, typed as `WrappedSchema<Input>`. Written inline in a JSX `validate` prop it no longer registers again on every render, which a new schema object did. `debounced` on a schema hands the validator's `signal` through, so a newer run ends the wait.
