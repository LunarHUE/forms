---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

Errors for a field name the form doesn't have now land on the root. Before, `setErrors({ fields: { nope: ... } })` and a form validator's `fields` put them on a path nothing renders, so the user never saw them. A server that renames a field no longer makes its errors disappear. They show with the form's errors, after the `form` ones, and development warns with the new code `field:unknown`, once per name.

A name counts as a field when each step exists in the form's value: a key its object has, or an index its array has. A key the value lacks still counts while something renders or validates a field there, such as an optional field with an input. Names under a missing object count too, since the value can't say what it would hold.

`store.pathOf(name)` is new. It returns the stable path of a dotted name, such as `rows.0.title`, or `undefined` when no field has it. Use it to route errors for unknown names somewhere else, such as a toast:

```ts
const unknown = Object.keys(serverErrors).filter((name) => store.pathOf(name) === undefined);
```

`store.fieldAt(path)` uses the same rule, so it now returns `undefined` for a key the value lacks while nothing renders or validates it. Code that called `fieldAt` to write a field that isn't in the value yet should walk the handles instead, as `store.root.at("nickname")`, which still makes a handle for any key.

Errors for a name that went to a hidden path before now land on the root. Two effects to check when upgrading:

- A form whose root errors aren't rendered can now hide these errors there instead. Render the root's errors, as [`submit:unseen`](https://forms.lunarhue.dev/errors#core:submit:unseen) shows.
- An error that only some name reached now sits on the root, so `field.peek().errors` at that name is empty and the root's list is longer.
