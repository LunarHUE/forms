# @lunarhue/forms-core

## 0.2.0

### Minor Changes

- [#190](https://github.com/LunarHUE/forms/pull/190) [`ce5885d`](https://github.com/LunarHUE/forms/commit/ce5885dbcda65cc5ad731e86f03552722160d326) Thanks [@tristendillon](https://github.com/tristendillon)! - Lists moved into a new `arrays()` plugin. It brings item keys that follow the items and the array commands `push`, `insert`, `remove` and `move`. `Items`, `useItems` and `createItems` take only array handles of forms that have it. A form with no lists no longer ships any of this, which saves about 550 B brotli. A form with a list pays about 150 B more than before.
  
  `form.Items` and `scope.Items` are gone. Import `Items` from the adapter and pass it the array's handle:
  
  ```tsx
  // Before
  <form.Items name="tasks">{(task, index) => ...}</form.Items>
  
  // After
  import { Items } from "@lunarhue/forms-react"; // or "@lunarhue/forms-solid"
  
  <Items handle={form.root.at("tasks")}>{(task, index) => ...}</Items>
  ```
  
  To migrate, add `arrays()` to every form that renders or changes a list:
  
  ```ts
  import { arrays } from "@lunarhue/forms-react/plugins"; // or "@lunarhue/forms-solid/plugins"
  
  const forms = createForms({ plugins: [arrays()] });
  ```
  
  You can also put it in a single definition's `plugins`. Without it, passing an array handle to `Items`, `useItems` or `createItems`, or calling a command, is a type error that says "Add arrays() to this form's plugins". Code without types that calls a command throws `arrays:missing` in development, and the command does nothing in production.
  
  A component that takes an array field and renders or changes it says so in its type, as `ArrayHandle<string[], typeof arrays>`. It then fits only forms with `arrays()`. A plugin whose setup calls the commands should list `arrays` in `requires`. `PluginContext.store` is now typed with the names of the plugin's `requires`, so such a plugin gets the commands in its types.
  
  A form without `arrays()` can still hold an array and replace it whole with `setValue`. Its rows are then keyed by position (`k0`, `k1`, ...), so a row's state, such as touched, belongs to the position. If `setValue` shortens the list and a later write lengthens it again, the rows past the old end come back under their old keys with their old state. With `arrays()` they stay gone and new rows get new keys, as before.

- [#203](https://github.com/LunarHUE/forms/pull/203) [`5638f90`](https://github.com/LunarHUE/forms/commit/5638f90b0f0fd0d6e11d9db18c66915c3678b3a9) Thanks [@tristendillon](https://github.com/tristendillon)! - `errorsByKind(handle)`, a new core function the adapters re-export, returns a field's validation errors grouped by the kind of validator that set them: `{ schema, form, field }`. `schema` holds the definition's schema errors, `form` the errors from `validate.form`, and `field` those from `validate.fields` and `registerValidator`, in the order they were added. A thrown validator's error goes under its validator's kind. Errors from `setErrors` aren't included, since the snapshot's `userErrors` has them. It is a read, not a subscription, and a standalone function rather than a store method, so a form that never calls it doesn't ship it. The new `ErrorsByKind<E>` and `ValidatorKind` types name the result and its keys.

- [#200](https://github.com/LunarHUE/forms/pull/200) [`bcc99bb`](https://github.com/LunarHUE/forms/commit/bcc99bb76683bd4febf4886039768095712a00a2) Thanks [@tristendillon](https://github.com/tristendillon)! - Errors from `setErrors` now make a field invalid, and core can list every invalid field.
  
  `invalidFields(store)`, a new core function, returns every field with an error, in form order, as `{ field, name, errors }`. The root comes first, with name `""`. `subscribeInvalid(store, listener)` fires when that list may change. Both are standalone functions rather than store methods, so a form that never lists its errors doesn't ship them. `useInvalidFields(form)` in React and `createInvalidFields(form)` in Solid follow the list, so an error summary is a few lines. The new `InvalidField<E>` type names an entry.
  
  The field snapshot has a new `userErrors` member, the errors `setErrors` put there. They come last in `errors`, so the validation errors are `errors.slice(0, errors.length - userErrors.length)`.
  
  Breaking changes:
  
  - `snapshot.invalid` is true for a field with only `setErrors` errors. Before, it counted validation errors only. Code that read `invalid` to mean "a validator failed" should check `errors.length > userErrors.length` instead. The form's `valid` hasn't changed, so server errors still don't block the next submit.
  - `store.firstInvalid()` and `store.disabledInvalid()` now include fields with only `setErrors` errors. After a server refuses a save, `firstInvalid()` returns the field it named, so the app can focus it. The adapters still don't move focus after `onSubmit` sets errors, because that submit succeeded.
  - `DisabledInvalid<E>` is now an alias of `InvalidField<E>`. Its shape is unchanged.

- [#230](https://github.com/LunarHUE/forms/pull/230) [`23b8bef`](https://github.com/LunarHUE/forms/commit/23b8bef0e6d6803cce628a4e9b7e77da56f9101d) Thanks [@tristendillon](https://github.com/tristendillon)! - A definition's validators go through two functions: `validate.fields` takes `fieldValidators({...})` and `validate.form` takes `formValidator(check)`. Core and both adapters export them. A form that uses neither doesn't ship the code that walks a validator tree or reads an `ErrorMap`. `validate.on` is gone: wrap a check in `validateOn(check, timing)`, or set `validate` on `createForms` for every form.
  
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

- [#284](https://github.com/LunarHUE/forms/pull/284) [`c8a59a2`](https://github.com/LunarHUE/forms/commit/c8a59a212b4d50ec7b1b7ec3fbefef6a1ea2ba29) Thanks [@tristendillon](https://github.com/tristendillon)! - `define` in `/mini` takes a function of per-form options, as the main entry's does: `forms.define((options: { q: string }) => ({ defaultValues: { q: options.q } }))`. The function runs once per store. `createStore(options, instance?)` and `useForm(definition, options, settings?)` take the options first, and a plain config still takes none. `useForm` reads the options on the first render only. Mini's `define` type parameters are now `<V, S, O, R>`, so `O` sits where it does on the main entry.

- [#262](https://github.com/LunarHUE/forms/pull/262) [`2ee8b18`](https://github.com/LunarHUE/forms/commit/2ee8b1877629cf80125ee4158c666a3d911834cd) Thanks [@tristendillon](https://github.com/tristendillon)! - New experimental entries, `@lunarhue/forms-core/mini` and `@lunarhue/forms-react/mini`, for small forms such as a search box or a login. A search form on `/mini` is about 2.6 kB brotli with React external, against about 11 kB on the main entry. Expect breaking changes in minor releases while it is experimental.
  
  `/mini` keeps `createForms().define()`, `useForm`, `form.Form`, `form.Field`, `form.State`, `inputProps`, `fieldValidators`, Standard Schema validation, `setErrors`, `reset` and the `transform`, `text` and `observe` parts, pinned at a field with `forms.fieldset(...parts).at(name)`. Every member has the same name and call as in the main entry, and its types are a subset of the main entry's, so a form moves up by changing the import. Validators run sync, on blur and on submit, then on each change once the field was blurred, has an error, or the form was submitted.
  
  It leaves out async validation, plugins, arrays, object fields in `form.Field`, dirty state, meta, native mode and devtools. Passing a plugin or a plugin's part to its `define` is a type error.
  
  By default a `/mini` form wakes every listener on each change, which is the least code. `createForms({ subscribe: perField() })` wakes only the fields that changed, for about 220 B more. The main entry takes the same option and ignores it, since it always wakes per field.

- [#182](https://github.com/LunarHUE/forms/pull/182) [`d6b2008`](https://github.com/LunarHUE/forms/commit/d6b2008ebfa9fc033a71e027b8b3e4d49f06c96d) Thanks [@tristendillon](https://github.com/tristendillon)! - `dirty` and `changes()` exist in the types only on forms with `dirty()`. Reading `dirty` from a form or field snapshot, from `useField`, `useFormState`, a `Field`, `form.State` or the Solid readers, or calling `store.changes()`, is a type error without it, and so is giving `equals`. The snapshots still hold `dirty: false` at runtime. In development `changes()` without `dirty()` now throws `dirty:missing` instead of logging `dirty:untracked`, and in production it returns an empty list.
  
  Stores and snapshots take the installed plugin names as a new last type parameter. Handles and the adapters' field types take the plugins by factory, before the error type. A component that reads `dirty` from its field types it as `FieldApi<string, typeof dirty>` and then fits only forms with `dirty()`. `AnyFormStore<E, "dirty">` is a store of any form that has it.
  
  One `Plugin<A, N, M, F, S>` type replaces `Plugin`, `HookPlugin`, `SchemaPlugin`, `DirtyPlugin`, `AnyPlugin` and `AnyHookPlugin`. Use `Plugins` for a list of any plugins. `defineSchemaPlugin(adapter)` is gone. Write `definePlugin({ name, schema: adapter })`.
  
  A plugin with field or form meta must give `initialMeta` or `initialFormMeta`, so its `meta` and `formMeta` readers never return `undefined`. Meta with no sensible start puts `undefined` in its type and starts from `initialMeta: undefined`.
  
  `IfDirty`, `HasDirty` and `EqualsNeedsDirty` are replaced by one `Needs` type. `HasSchemaPlugin`, `PluginSchemas`, `MetaSource`, `When` and `PluginDefinition` are no longer exported. `PluginNames` and `PluginsOf` are new exports.
  
  `FormStore<V, FormError>` no longer fits a parameter typed `FormStore<V, unknown>`. Make such a helper generic over the error type.

- [#256](https://github.com/LunarHUE/forms/pull/256) [`b96e3b5`](https://github.com/LunarHUE/forms/commit/b96e3b53fb909bb0b989ba85bba2dcc99e767757) Thanks [@tristendillon](https://github.com/tristendillon)! - `definePlugin` returns a factory instead of a plugin. Call it to get the plugin for a form's `plugins`, the way the built-ins work:
  
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
  
  `FieldApi`'s parameters are now `<T, P, E>`: the plugins come before the error type. Name several plugins as a union, `typeof dirty | typeof history`. The handle types follow the same order: `FieldHandle`, `LeafHandle`, `ObjectHandle`, `ArrayHandle` and `ItemHandle` are `<V, P, E>`, as in `ArrayHandle<Tag[], typeof arrays>`, and `AnyFieldHandle` is `<P, E>`. A fieldset's type written out is `Fieldset<V, P, E, F, I>`, with `P` the plugins its parts need and `I` the shared plugins. The name-keyed forms that inference produces are `NamedFieldHandle`, `NamedArrayHandle`, `NamedFieldset` and so on.
  
  Renames for plugin authors:
  
  - The `attach` hook is `part`, and its context has `value()` for the value at the part's path and `at(name)` for a field below it.
  - The plugin-level `initial` is `initialValue`.
  - The `onSubmit` hook is `beforeSubmit`.
  - `ctx.attachments(path)` is `ctx.parts(path)`, and the `Attachment` type is `AttachedPart`.
  - The part hook `edit` is `afterInput`. It and `display` are part hooks only.
  - The part `initial` hook is gone. A part's `beforeWrite` runs once on attach with `cause: "attach"`, which does the same job.
  
  `persist(key, storage)` is now `persist(key)` or `persist({ key, storage })`.

- [#287](https://github.com/LunarHUE/forms/pull/287) [`d49c9a6`](https://github.com/LunarHUE/forms/commit/d49c9a6bfa0c860365c1a5a916eb2d3580a1fe7a) Thanks [@tristendillon](https://github.com/tristendillon)! - Plugins and parts get an `onBlur(path)` hook. It runs on every blur through a field's `handleBlur`, not only the first one that sets `touched`, so a plugin can save or clean up a field each time the user leaves it. It runs inside the blur's batch, after the field is touched and its blur validators ran, and writes it makes through `ctx.write` land in that batch. `setTouched(true)` doesn't run it. A part gets only the blurs at or below its path. Forms without hook plugins or parts don't grow.

- [#182](https://github.com/LunarHUE/forms/pull/182) [`337d9d1`](https://github.com/LunarHUE/forms/commit/337d9d115ca45f547b2af8fa7a9339d3d5ac32fe) Thanks [@tristendillon](https://github.com/tristendillon)! - Plugins that work per field now take parts. A part is a plugin's config for one place: a field type, a fieldset or a form. The plugin goes in the form's plugins once, with no config, and its parts go where they apply. Using a field type or fieldset whose parts need a plugin the form lacks is a type error, such as `Add rules() to this form's plugins: AddressField uses it`. Without types the store throws `plugins:missing` in development.
  
  `defineField(component, ...parts)` from the adapters makes a field type. Register it in `fields` like a component. Its parts attach at each field it renders, the first time it renders it. `forms.fieldset(schema, ...parts)` and `forms.fieldset<V>(...parts)` take parts for each field the fieldset is used on, and `forms.define(config, ...parts)` takes parts for the whole form. `PhoneField.at(name)` and `Billing.at(name)` pin a field type's or fieldset's parts at one field, for `define`, so they attach when the store is made.
  
  Fieldset scopes now carry the plugin names their parts need, so the field components a fieldset renders are checked against them.
  
  To migrate a mask, put `masked(...)` from `/text` on the field type that renders the field. It needs no plugin:
  
  ```ts
  // Before
  const contact = forms.define({ defaultValues, plugins: [mask({ phone: { clean: digits, display: formatPhone } })] });
  
  // After
  import { digits, masked } from "@lunarhue/forms-react/text";
  const PhoneField = defineField(PhoneInput, masked({ clean: digits, display: formatPhone }));
  const forms = createForms({ fields: { PhoneField } });
  const contact = forms.define({ defaultValues });
  ```
  
  A wildcard such as `"lines.*.sku"` becomes a field type on the row's component. A field that may not render before its value matters, such as one on a later step, takes `PhoneField.at("phone")` after the config. `mask`'s `name` option is gone: a field type can carry two `masked` parts, which clean in order, and the first display wins.
  
  To migrate rules, install `rules()` and pass `ruled(...)` after the config. It takes the value type from the definition, so it needs no type argument. Read `hidden` with `rules.meta(field)`:
  
  ```ts
  // Before
  const orderRules = rules<Order>({ street: (value) => ({ disabled: value.pickup }) });
  const order = forms.define({ defaultValues, plugins: [orderRules] });
  orderRules.meta(field).hidden;
  
  // After
  const order = forms.define({ defaultValues }, ruled({ street: (value) => ({ disabled: value.pickup }) }));
  rules.meta(field).hidden;
  ```
  
  Rules on a fieldset get the fieldset's value: `forms.fieldset(Billing, ruled({ ... }))`. To write rules apart from a definition, name the type, as `ruled<Order>({ ... })`.
  
  A plugin list can hold `false`, `null` or `undefined`, as in `plugins: [rules(), dev && devtools()]`. The form skips them, and the types count a plugin that may be missing as not installed.
  
  For plugin authors:
  
  - `definePlugin` takes `part(ctx, config)`, which runs once per path a part attaches at and returns hooks for that path. Its hooks get writes at or above the path walked down to it, and a refuse there refuses the whole write. `part(limit, config)` makes the parts, with `config` typed from that parameter: `part(limit, { max: 20 })`.
  - `requires: () => [dirty]` names plugins a plugin needs. The form must install them, or it is a type error. The plugin's hooks run after theirs, and `ctx.plugins` holds their APIs.
  - `ctx.installed` lists the store's plugins in hook order, and `ctx.parts(path)` the parts attached at a path and above.
  - A part's `beforeWrite` runs once on the value at its path when it attaches, with `cause: "attach"`. That write makes no record. A value it changes moves the baseline with it while the field isn't dirty, and a reset to the initial values keeps it clean.
  - `FieldDisplay` meta is gone. Return `display` and `afterInput` hooks from `part` instead.
  
  New exports: `Part` and `Parts` from core, and `defineField` and `FieldType` from the adapters. Core also exports `attach` for the adapters, and `MetaHolder`, `PluginMembers`, `Nested` and `DefineParts` because declarations name them. Those are internal.

- [#166](https://github.com/LunarHUE/forms/pull/166) [`cf1b97e`](https://github.com/LunarHUE/forms/commit/cf1b97e89a1e38823fa7769dc998d731f5b04f7e) Thanks [@tristendillon](https://github.com/tristendillon)! - Every first-class plugin now comes from one `plugins` entry, and the per-plugin entries are gone. Your bundler still drops the plugins you don't import, so bundles don't grow. Change your imports:
  
  | Before | After |
  | --- | --- |
  | `@lunarhue/forms-core/plugins/bind` | `@lunarhue/forms-core/plugins` |
  | `@lunarhue/forms-core/plugins/dirty` | `@lunarhue/forms-core/plugins` |
  | `@lunarhue/forms-core/plugins/history` | `@lunarhue/forms-core/plugins` |
  | `@lunarhue/forms-core/plugins/mask` | `@lunarhue/forms-core/text`, which has `masked` and no `mask()` plugin |
  | `@lunarhue/forms-core/plugins/persist` | `@lunarhue/forms-core/plugins` |
  | `@lunarhue/forms-core/plugins/rebase` | `@lunarhue/forms-core/plugins` |
  | `@lunarhue/forms-core/plugins/rules` | `@lunarhue/forms-core/plugins` |
  | `@lunarhue/forms-react/plugins/<name>` | `@lunarhue/forms-react/plugins` |
  | `@lunarhue/forms-solid/plugins/<name>` | `@lunarhue/forms-solid/plugins` |
  
  Imports from two plugins merge into one line, such as `import { dirty, rebase } from "@lunarhue/forms-react/plugins"`. `@lunarhue/forms-core/plugins/testing` stays where it is, so test helpers can't reach an app bundle by accident.
  
  The React and Solid packages now carry core's declarations in their own, and their main entries re-export the plugin types, such as `HistoryApi` and `RulesPlugin`. Declarations that tsc writes for your code name only the adapter, so they type-check under pnpm or Bun's isolated installs, where your project can't see `@lunarhue/forms-core`. Each adapter ships three to six bundled `.d.ts` files in place of one per source file.
  
  `@lunarhue/forms-bind` imports `bind` from the new entry, so it needs this version of core.

- [#210](https://github.com/LunarHUE/forms/pull/210) [`77c06c5`](https://github.com/LunarHUE/forms/commit/77c06c50056bcd21bc855859d79e154a300e56d2) Thanks [@tristendillon](https://github.com/tristendillon)! - `fieldOf(element)` now works in production for apps that opt in. Call `trackElements()` before the form renders, and from then on the adapters' refs record which field each element belongs to. Elements mounted before that call aren't recorded. Development needs no call, as before.
  
  `trackElements(listener)` also takes a listener that gets every element a ref records or forgets, with its field handle, or its store for a `<form>` element, and the adapter's name. React before 19 doesn't say which element left, so those removals come late, the next time the adapter looks at that field's elements.
  
  Without the call, the adapters cost about 30 to 40 B more, brotli, for the slot the refs report to.

- [#282](https://github.com/LunarHUE/forms/pull/282) [`5ec1188`](https://github.com/LunarHUE/forms/commit/5ec1188843336c8f0a61702c43c2126e0a827711) Thanks [@tristendillon](https://github.com/tristendillon)! - A submit whose `onSubmit` leaves errors on the form with `setErrors` now ends `"invalid"`, not `"succeeded"`. That is how the docs say to handle a server that refuses the save, and nothing was saved, so it no longer reads as a success. `baselineOnSubmit()` leaves the refused values dirty instead of taking them as the baseline, and React and Solid move focus to the first field the server refused, as they do after a failed validation.
  
  Validation errors don't count, so a field the user breaks while the save runs doesn't turn a real save into a refusal. Errors cleared before `onSubmit` returns don't count either.
  
  When upgrading:
  
  - Code that set errors in `onSubmit` and then checked for `"succeeded"`, or read a message from its `result`, now sees `{ status: "invalid" }` with no result. Show the refusal from the errors you set, such as the root's errors for a `form` message.
  - A plugin's `onSubmitted` gets the submitted value as `input` for such a submit, though its status is `"invalid"`. It is still undefined when validation or a plugin stopped the submit.
  - To focus the refused field you no longer need to call `store.firstInvalid()` after the submit. Pass `focusOnInvalid: false` to keep focus where it was.

- [#283](https://github.com/LunarHUE/forms/pull/283) [`72b0b6b`](https://github.com/LunarHUE/forms/commit/72b0b6bd7fef643d6dbdd15bd95bf4a01507073f) Thanks [@tristendillon](https://github.com/tristendillon)! - `store.reset({ values })` sets new values and makes them the baseline in one step, and clears touched, edited and error state as `reset()` does. Use it after a save or a refetch when the user's edits should go: with `dirty()` the form is clean afterwards, and a later `reset()` comes back to these values. It works in `/mini` too.

- [#204](https://github.com/LunarHUE/forms/pull/204) [`315ff3d`](https://github.com/LunarHUE/forms/commit/315ff3d6345bf1b25716656d71dd3ad2d97f0bc9) Thanks [@tristendillon](https://github.com/tristendillon)! - Handles are strict in their value type. A component that asks for `ArrayHandle<Tag[]>` no longer takes the handle of a `WideTag[]` with more keys, since its `push` and `setValue` would store items without them. The same holds for object handles and for `HandleOf<typeof fieldset>`. A handle of a form with more plugins still fits one that asks for fewer.
  
  To keep a reusable component that takes wider values, make it generic. A fieldset component passes its type parameter as the second argument of `HandleOf`:
  
  ```tsx
  // Before
  function AddressFields(props: { field: HandleOf<typeof AddressFieldset> }) { ... }
  
  // After
  function AddressFields<A extends Address>(props: { field: HandleOf<typeof AddressFieldset, A> }) { ... }
  ```
  
  A list component is generic in its item type and takes a function that makes a full item, since it can't build the keys it doesn't know:
  
  ```tsx
  function TagList<T extends Tag>(props: { tags: ArrayHandle<T[], FormError, "arrays">; create: (base: Tag) => T }) {
    // props.tags.push(props.create({ id: 1, name: "" }))
  }
  ```
  
  Inside such a component, `field.at("city")` reads as its type in the constraint, so it fits a `FieldApi<string>` component. Some things still need help:
  
  - `useInputProps` and `createInputProps` read the value type from the handle's own type. Type the child first: `const city: FieldHandle<string> = field.at("city")`.
  - A merge write on a generic object, `field.setValue({ city: "Oslo" })`, doesn't type-check. Write the child: `field.at("city").setValue("Oslo")`.
  - A child that is an object itself stays generic and needs a generic component of its own.
  - A generic handle passes only to props with the same plugin list. Type props as `HandleOf<typeof fieldset, A>` so they share the fieldset's.
  
  Type changes that come with it:
  
  - `setValue` on object and array handles, and `push` and `insert` on array handles, are properties instead of methods.
  - `FieldHandle<V>` distributes over a generic `V`'s constraint, which is how the children of a generic handle resolve. For concrete types it gives the same handles as before.
  - `fieldset.scope(handle)` infers the handle's type, and `Scope` and `ScopeMembers` take the root's value type as a last, optional parameter.
  - `HandleOf` takes an optional second parameter, the value type. It defaults to the fieldset's.
  - In Solid, a `FieldType` is checked exactly against the component type it was made with.

- [#200](https://github.com/LunarHUE/forms/pull/200) [`17da5a8`](https://github.com/LunarHUE/forms/commit/17da5a8d1665e2f6cb5a63d080cb28b642516808) Thanks [@tristendillon](https://github.com/tristendillon)! - Errors for a field name the form doesn't have now land on the root. Before, `setErrors({ fields: { nope: ... } })` and a form validator's `fields` put them on a path nothing renders, so the user never saw them. A server that renames a field no longer makes its errors disappear. They show with the form's errors, after the `form` ones, and development warns with the new code `field:unknown`, once per name.
  
  A name counts as a field when each step exists in the form's value: a key its object has, or an index its array has. A key the value lacks still counts while something renders or validates a field there, such as an optional field with an input. Names under a missing object count too, since the value can't say what it would hold.
  
  `store.pathOf(name)` is new. It returns the stable path of a dotted name, such as `rows.0.title`, or `undefined` when no field has it. Use it to route errors for unknown names somewhere else, such as a toast:
  
  ```ts
  const unknown = Object.keys(serverErrors).filter((name) => store.pathOf(name) === undefined);
  ```
  
  `store.fieldAt(path)` uses the same rule, so it now returns `undefined` for a key the value lacks while nothing renders or validates it. Code that called `fieldAt` to write a field that isn't in the value yet should walk the handles instead, as `store.root.at("nickname")`, which still makes a handle for any key.
  
  Errors for a name that went to a hidden path before now land on the root. Two effects to check when upgrading:
  
  - A form whose root errors aren't rendered can now hide these errors there instead. Render the root's errors, as [`submit:unseen`](https://forms.lunarhue.dev/errors#core:submit:unseen) shows.
  - An error that only some name reached now sits on the root, so `field.peek().errors` at that name is empty and the root's list is longer.

- [#166](https://github.com/LunarHUE/forms/pull/166) [`eaf3086`](https://github.com/LunarHUE/forms/commit/eaf308667e141235a66b8859e69e9dd16290d535) Thanks [@tristendillon](https://github.com/tristendillon)! - Validation is built into core again. A form with no plugins can take `validate` on its definition and a `validate` prop on a field, and `field.validate()` and `registerValidator` work instead of throwing.
  
  `validation()` is gone, along with the `plugins/validation` entry of core, React and Solid. Drop it from your `plugins` list. `defineSchemaPlugin` moved to `@lunarhue/forms-core/plugins`. Schema plugins such as `valibot()` and `zod()` now only give a schema's default values. A schema whose library has no plugin installed still needs complete `defaultValues`, and leaving them out is a type error that names `NoSchemaPlugin`.
  
  Removed types: `IfValidation`, `HasValidation`, `ValidationNotInstalled`, `SchemaNeedsValidation`, `ValidationPlugin`, and `ValidatePropFor` in the adapters. `Scope` and `Fieldset` in the adapters lose their plugin type parameter, and so do the bound component types under them. The `validation:definition` and `validation:validator` errors are gone.
  
  The main entry of core grows by about 1.9 kB brotli, since it now carries the runner.

- [#273](https://github.com/LunarHUE/forms/pull/273) [`8919bef`](https://github.com/LunarHUE/forms/commit/8919bef7a9b919ffffe2de019b0c72b83806c78f) Thanks [@tristendillon](https://github.com/tristendillon)! - New `pipe(...checks)` runs validators one after another on the same value and stops at the first that returns an error. Put cheap checks before a server check, and the server check runs only once they pass:
  
  ```ts
  username: pipe(
    (name) => (name.length < 3 ? { message: "Use at least 3 characters." } : undefined),
    debounced(async (name, { signal }) => ((await isTaken(name, signal)) ? { message: "That name is taken." } : undefined), 400),
  ),
  ```
  
  While its checks answer at once, so does the pipe. A failing sync check never starts the debounced one after it, so the field doesn't show `validating`. Submit and `validate()` skip a debounce inside a pipe, even one the pipe hasn't reached yet. The checks can be field validators, form validators, Standard Schemas or wrapped checks, and a schema's issues still go through `mapError`. Wrap the pipe in `validateOn` to set its timing.

- [#230](https://github.com/LunarHUE/forms/pull/230) [`5533930`](https://github.com/LunarHUE/forms/commit/55339305450e1bc4c0999c5c54172f28fde017dc) Thanks [@tristendillon](https://github.com/tristendillon)! - Validator timing moves from an options object to three wrappers: `debounced(check, ms)`, `validateOn(check, "input" | "blur" | "submit")` and `recheckOnSubmit(check)`. Each takes a validator function or a Standard Schema, returns a check that goes anywhere a bare one does, and nests in any order. The `{ validate, debounce, on, recheckOnSubmit }` object is gone, along with the `ValidatorOptions` and `FormValidatorOptions` types.
  
  ```ts
  // Before
  username: { validate: checkName, debounce: 400, on: "input", recheckOnSubmit: true }
  
  // After
  username: recheckOnSubmit(validateOn(debounced(checkName, 400), "input"))
  ```
  
  The same goes for `validate.form`, the `validate` prop, `useValidator`, `createValidator` and `registerValidator`.
  
  A wrapped schema is a function, typed as `WrappedSchema<Input>`. Written inline in a JSX `validate` prop it no longer registers again on every render, which a new schema object did. `debounced` on a schema hands the validator's `signal` through, so a newer run ends the wait.

### Patch Changes

- [#166](https://github.com/LunarHUE/forms/pull/166) [`c4e1b11`](https://github.com/LunarHUE/forms/commit/c4e1b118d010229149d0b04033ae0de3e805e580) Thanks [@tristendillon](https://github.com/tristendillon)! - The `deferred` and `idle` delivery code moved out of the plugin host and now comes with `definePlugin`. The built-in plugins that only use `sync`, which are `bind`, `rules`, `rebase` and `baselineOnSubmit`, no longer bring it, so a form that installs only those is smaller. Plugins made with `definePlugin` work as before.

- [#230](https://github.com/LunarHUE/forms/pull/230) [`fc15100`](https://github.com/LunarHUE/forms/commit/fc151007a8e9f36de4326d20acbb5c3af13f00b0) Thanks [@tristendillon](https://github.com/tristendillon)! - Trim a few code paths in the store and the React ref handling. `stats()` now returns zero counts in a production build, since only tests and leak checks read it. Nothing else changes for apps, so there's nothing to migrate.

## 0.1.1

### Patch Changes

- [#148](https://github.com/LunarHUE/forms/pull/148) [`c7cbf4e`](https://github.com/LunarHUE/forms/commit/c7cbf4eee7bd0420d04cb2eaf250669760c21625) Thanks [@tristendillon](https://github.com/tristendillon)! - A plugin can now write from the cleanup its `onActive` returns. The write runs when the last listener goes, and `onWrite` observers get its records with the plugin as the cause. Before, a `ctx.write` from that cleanup waited for the next write to the store, which might never come.

- [#150](https://github.com/LunarHUE/forms/pull/150) [`0c7648c`](https://github.com/LunarHUE/forms/commit/0c7648cd871cd78d73204347c81a4a7bb29e7de7) Thanks [@tristendillon](https://github.com/tristendillon)! - In a form without a schema, `onSubmit` now gets a copy of the form value that it may change, in development and production alike. Sorting or pushing to an array in `onSubmit` no longer throws in development, and it leaves the form's own value as it was.

- [#154](https://github.com/LunarHUE/forms/pull/154) [`094145b`](https://github.com/LunarHUE/forms/commit/094145b751fc9510f112510d52a9d046c1ecf439) Thanks [@tristendillon](https://github.com/tristendillon)! - You can write a value you read from a field straight back. `setValue`, `push`, `insert` and the rebase plugin now take the readonly values that `peek()` and field objects return, so `tags.setValue(tags.peek().value)` compiles without a spread or a cast.

- [#152](https://github.com/LunarHUE/forms/pull/152) [`ab94acc`](https://github.com/LunarHUE/forms/commit/ab94acc9a9375d0b81138b59d0e87cfac3644e47) Thanks [@tristendillon](https://github.com/tristendillon)! - `define` now accepts a value type that refers to itself, such as a tree node with a `children` array of tree nodes, or two types that refer to each other. Before, TypeScript rejected these with error TS2615.

## 0.1.0

### Minor Changes

- [#119](https://github.com/LunarHUE/forms/pull/119) [`e180e75`](https://github.com/LunarHUE/forms/commit/e180e752ac61ca2651b18acb36c5eef43b7e8add) Thanks [@tristendillon](https://github.com/tristendillon)! - First release.

### Patch Changes

- [#118](https://github.com/LunarHUE/forms/pull/118) [`855500b`](https://github.com/LunarHUE/forms/commit/855500be2a57836db9c67729e7942446ac073b54) Thanks [@tristendillon](https://github.com/tristendillon)! - A write a plugin queues from `onSubmitted` is now applied when the hook returns, with one notification. Before, it waited for the next write from anywhere else.
