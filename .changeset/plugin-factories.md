---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
"@lunarhue/forms-devtools": minor
---

`definePlugin` returns a factory instead of a plugin. Call it to get the plugin for a form's `plugins`, the way the built-ins work:

```ts
const collapseSpaces = definePlugin({
  name: "collapseSpaces",
  setup: () => ({ beforeWrite: (write) => (typeof write.value === "string" ? write.value.replace(/ {2,}/g, " ") : write.value) }),
});
createForms({ plugins: [collapseSpaces()] });
```

A second parameter on `setup` types the factory's options, and `initialValue` gets them too. Without one, the factory takes no arguments.

The meta readers moved from the plugin to the factory: `history.formMeta(state)` and `upload.meta(field)`, with no instance to keep around. The factory's `part<V>(config)` makes the plugin's parts, typed from the `part` hook's config parameter, so hand-written `Part<"name", V>` constructors aren't needed.

`requires` takes factories, as `requires: () => [dirty]`, and also orders the hooks: a plugin's run after the ones it requires. `after` is gone. With `requires: () => [dirty]`, `ctx.store` has `changes()` and the `dirty` flags.

Components and fieldsets name plugins by factory, not by name:

```ts
// Before
function ChangedMark({ field }: { field: FieldApi<string, FormError, "dirty"> }) {}
const Billing = forms.fieldset<Billing, "rules">(ruled({ ... }));

// After
function ChangedMark({ field }: { field: FieldApi<string, typeof dirty> }) {}
const Billing = forms.fieldset<Billing, typeof rules>(ruled({ ... }));
```

`FieldApi`'s parameters are now `<T, P, E>`: the plugins come before the error type. Name several plugins as a union, `typeof dirty | typeof history`.

Renames for plugin authors:

- The `attach` hook is `part`, and its context has `value()` for the value at the part's path and `at(name)` for a field below it.
- The plugin-level `initial` is `initialValue`.
- The `onSubmit` hook is `beforeSubmit`.
- `ctx.attachments(path)` is `ctx.parts(path)`, and the `Attachment` type is `AttachedPart`.
- The part hook `edit` is `afterInput`. It and `display` are part hooks only.
- The part `initial` hook is gone. A part's `beforeWrite` runs once on attach with `cause: "attach"`, which does the same job.

`persist(key, storage)` is now `persist(key)` or `persist({ key, storage })`.
