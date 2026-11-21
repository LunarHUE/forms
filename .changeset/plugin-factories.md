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

The meta readers moved from the plugin to the factory: `history.formMeta(state)` and `upload.meta(field)`, with no instance to keep around.

`part(plugin, config)` from `/plugins` makes a plugin's parts, with `config` typed from the `part` hook's second parameter, so hand-written parts aren't needed. `Part` names the plugin by its factory too: `Part<typeof limit, string>`, where it used to take the name. The part's value type comes from where it goes. To fix it in a helper, annotate the return type or pass both type arguments:

```ts
const limited = (max: number): Part<typeof limit, string> => part(limit, max);
const limited = (max: number) => part<typeof limit, string>(limit, max);
```

A part can also bring hooks of its own and need no plugin. `part<V>(hooks)` takes the hooks, or a function of the part's context that returns them, typed for the value `V`. Three helpers cover the common cases:

- `transform<V>((value, write) => ...)` changes each write at its path, and the value there when it attaches. Return `refuse` to stop the write.
- `text<V>(display, afterInput?)` sets the text a text input shows.
- `observe<V>((value, ctx) => ...)` runs when it attaches and after each batch that wrote at its path. Write through `ctx.write`.

```ts
const trimmed = transform<string>((value) => value.trim());
const slug = observe<Post>((post, ctx) => ctx.write(() => ctx.at("slug").setValue(slugify(post.title))));
```

These parts run after every plugin's hooks. A store sets up their hooks from the parts it knows when it is made: the parts after a definition's config, and those on the field types and fieldsets of its `createForms`. A fieldset made after the store, on a store whose plugins have no hooks, throws `parts:late` in development.

`defineField` and `fieldset` take lists of parts too, so a helper can return several.

Masks moved to a new `/text` entry, on core and both adapters, and the `mask()` plugin is gone. `masked`, `cleaned`, `displayed`, `digits`, `upper` and `replaceText` come from `@lunarhue/forms-react/text` or `@lunarhue/forms-solid/text`, and a masked field type needs nothing in `plugins`:

```ts
// Before
import { digits, mask, masked } from "@lunarhue/forms-react/plugins";
const forms = createForms({ plugins: [mask()], fields: { PhoneField } });

// After
import { digits, masked } from "@lunarhue/forms-react/text";
const forms = createForms({ fields: { PhoneField } });
```

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
