---
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

New `isFocused(handle)` export. It is true while focus is on one of the field's elements or inside one, such as the input inside a custom component registered with `useFieldRef` or `fieldRef`. It reads the same elements as `elementsOf`, so it works in production with no `trackElements()` call, and it returns false on the server.

Use it in a `rebase()` resolve to keep the field the user is in, even before they type:

```ts
form.plugins.rebase(form.root, fresh, (leaf) => {
  const field = form.store.fieldAt(leaf.path);
  return leaf.edited || (field !== undefined && isFocused(field)) ? "keep" : "take";
});
```
