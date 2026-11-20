---
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

A registered component typed `FieldApi<string | undefined>` now takes required string fields as well as optional ones, from a type given to `define` or from a schema. Before, it took only the optional ones, and a `FieldApi<string>` component took only the required ones, so no text component could render both. Checkboxes work the same way with `FieldApi<boolean | undefined>`, and `null` in the type works like `undefined`.

A `FieldApi<string>` component still rejects optional fields, so its `field.value` stays a `string`.

To render optional fields with an existing component, add `undefined` to its type and handle it where the component reads `field.value`. `inputProps` already shows it as an empty input or an unticked checkbox.

```tsx
// Before: <form.TextField name="nick" /> didn't compile for `nick?: string`
function TextField(props: { field: FieldApi<string>; label: string }) { ... }

// After: takes `name: string` and `nick?: string`
function TextField(props: { field: FieldApi<string | undefined>; label: string }) { ... }
```

The type checker doesn't stop such a component from writing `undefined` into a required field, the same gap a `FieldApi<number>` component has.

In a component generic over its value, pass an optional child by `name`. Its handle from `field.at("nick")` doesn't fit yet.
