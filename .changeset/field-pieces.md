---
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

`inputProps` is a function you import instead of a method on the field object. A form that binds its fields by hand no longer ships the props builder.

```tsx
// Before
<input {...field.inputProps({ kind: "number" })} />

// After
import { inputProps } from "@lunarhue/forms-react"; // or "@lunarhue/forms-solid"

<input {...inputProps(field, { kind: "number" })} />
```

Field objects now carry the pieces `inputProps` is built from, so a component library's input, checkbox or select can bind to a field directly: `text`, `setText(text, from?)`, `setNumberText(text, empty?)`, `handleBlur` and `ref`. `setText` keeps a mask's caret in place, and `setNumberText` keeps text such as `1.` while the user types. When `ref` gets a native input, textarea or select that shows something other than the field's state, as after a browser restores a form on reload, it puts the field's state back.

Removed types: `InputPropsMethod` in React and `InputPropsOf` in Solid. `useInputProps` and `createInputProps` still take a field handle.
