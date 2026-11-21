---
"@lunarhue/forms-react": patch
---

The doc comments on `inputProps`, the field's `ref` and `useFieldRef` now say how to pass a field's ref under React Compiler. `ref={field.ref}` makes the Compiler treat the whole field object as a ref and skip the component, so take it out first with `const { ref } = field`, or use `useFieldRef(handle)`.
