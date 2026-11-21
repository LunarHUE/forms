# @lunarhue/forms-devtools

## 0.2.0

### Minor Changes

- [#210](https://github.com/LunarHUE/forms/pull/210) [`d15b1af`](https://github.com/LunarHUE/forms/commit/d15b1afc42ab8de40c3eeb2e3915b737e46b00d1) Thanks [@tristendillon](https://github.com/tristendillon)! - New package `@lunarhue/forms-devtools`, with the `devtools()` plugin and `syncDevtools()`. Each form with the plugin registers with the page while it is mounted, and the plugin logs its last 500 writes and its submissions. `enabled` decides whether the panel shows, and the panel loads as a chunk of its own the first time a form's `enabled` reads true. The panel is empty for now. `dev && devtools()` leaves all of it out of production.

- [#210](https://github.com/LunarHUE/forms/pull/210) [`4a5bf86`](https://github.com/LunarHUE/forms/commit/4a5bf86eea02f450c9b6b5a11de138c0a342c087) Thanks [@tristendillon](https://github.com/tristendillon)! - The devtools panel can inspect fields on the page. With the inspect button on, or while Alt is held, a card shows the facts of the field under the pointer, and a click pins it and selects the field's row. Hovering a row of the Fields tab outlines that field's elements.

- [#210](https://github.com/LunarHUE/forms/pull/210) [`8e1ea20`](https://github.com/LunarHUE/forms/commit/8e1ea209b828ef7dd49a88c3118d355d283f66d3) Thanks [@tristendillon](https://github.com/tristendillon)! - The devtools panel has a Log tab, with the form's writes and submissions newest first, each write's cause and submissions a reset aborted, and a Plugins tab, with the form's plugins in hook order and each one's form meta and API.

- [#210](https://github.com/LunarHUE/forms/pull/210) [`b79a909`](https://github.com/LunarHUE/forms/commit/b79a9091a614ed3907e6bf0e772f2313d5c43dc6) Thanks [@tristendillon](https://github.com/tristendillon)! - The devtools panel. It docks in a corner of the page and lists the forms on the page by their store `id`. Pick mode outlines each form so you can click the one to inspect. The Fields tab shows the value tree with each field's flags, and a selected field's value against its baseline, display text, errors by source, attached plugins and last write. The panel is a chunk of its own with Preact bundled in, and renders in a shadow root. It reads the forms on each animation frame while it's open and never subscribes to a store.

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

### Patch Changes

- [#229](https://github.com/LunarHUE/forms/pull/229) [`f2ca593`](https://github.com/LunarHUE/forms/commit/f2ca59307f837ace5269252e8f49a25dd303e862) Thanks [@tristendillon](https://github.com/tristendillon)! - The devtools panel is closer to its design. A row's flags are icons, and hovering one shows what it means and its detail: the errors for invalid, baseline against value for dirty, the last write for edited. The field card shows only value, baseline and the field's writes with their causes. A row's pointer button scrolls the field's element into view. A filter box narrows the Fields tab by name, with a toggle for just the fields with errors. The bar shows how the last submission went, such as `submit failed`.

- [#254](https://github.com/LunarHUE/forms/pull/254) [`53ebbe8`](https://github.com/LunarHUE/forms/commit/53ebbe872fbc110b57b94daa0b7811a6d46113e0) Thanks [@tristendillon](https://github.com/tristendillon)! - The devtools panel renders nothing at 640px wide and below. Phones get no dock, no bottom sheet, no form outlines and no inspecting. Narrowing the window to that width unmounts the panel, and widening it brings the panel back.

- [#228](https://github.com/LunarHUE/forms/pull/228) [`8144131`](https://github.com/LunarHUE/forms/commit/8144131d0e094adaa779c8fb43c393d6a47a86e7) Thanks [@tristendillon](https://github.com/tristendillon)! - The devtools panel matches its design: while it's on, every form has a dashed outline with its name on a tag, and clicking the tag selects the form, so the pick button is gone. Inspecting stays on after a click, and hovering a label inspects the field it labels. A form with an `id` the adapter made up shows as `form 1`, `form 2` and so on. Menus open from their buttons, the clear button replaces the chevron in the form chip, the panel is as wide as the dock, scrollbars are thin and dark, and every icon button has a tooltip.

- [#233](https://github.com/LunarHUE/forms/pull/233) [`62a6829`](https://github.com/LunarHUE/forms/commit/62a682913994672f256a0886204cf2a09a0cbd9b) Thanks [@tristendillon](https://github.com/tristendillon)! - The devtools panel's styles are Tailwind utilities, compiled into the panel chunk at build time. The panel looks and works as before.

- [#233](https://github.com/LunarHUE/forms/pull/233) [`ade1903`](https://github.com/LunarHUE/forms/commit/ade19038a99260efddf5de17596b5864b14b69ca) Thanks [@tristendillon](https://github.com/tristendillon)! - The devtools panel's source is TSX on Preact's JSX runtime, and its icons come from Lucide. It works as before.

- [#233](https://github.com/LunarHUE/forms/pull/233) [`72d73b8`](https://github.com/LunarHUE/forms/commit/72d73b8e8ebe816c372aca3b96da79ae0858f1b8) Thanks [@tristendillon](https://github.com/tristendillon)! - The devtools panel no longer shows the last submission in its bar. A row's flags keep fixed places, a click anywhere on a row selects its field, and long values keep their start and end in the cards instead of widening them. The on-page field card drops the form's name and stays open while the pointer crosses from a label to its input. Outlines sit under the page's dialogs and drawers, and a hidden form, such as one in an inactive tab, no longer leaves an outline in the corner of the window.
- Updated dependencies [[`ce5885d`](https://github.com/LunarHUE/forms/commit/ce5885dbcda65cc5ad731e86f03552722160d326), [`5638f90`](https://github.com/LunarHUE/forms/commit/5638f90b0f0fd0d6e11d9db18c66915c3678b3a9), [`bcc99bb`](https://github.com/LunarHUE/forms/commit/bcc99bb76683bd4febf4886039768095712a00a2), [`23b8bef`](https://github.com/LunarHUE/forms/commit/23b8bef0e6d6803cce628a4e9b7e77da56f9101d), [`c4e1b11`](https://github.com/LunarHUE/forms/commit/c4e1b118d010229149d0b04033ae0de3e805e580), [`c8a59a2`](https://github.com/LunarHUE/forms/commit/c8a59a212b4d50ec7b1b7ec3fbefef6a1ea2ba29), [`2ee8b18`](https://github.com/LunarHUE/forms/commit/2ee8b1877629cf80125ee4158c666a3d911834cd), [`d6b2008`](https://github.com/LunarHUE/forms/commit/d6b2008ebfa9fc033a71e027b8b3e4d49f06c96d), [`b96e3b5`](https://github.com/LunarHUE/forms/commit/b96e3b53fb909bb0b989ba85bba2dcc99e767757), [`d49c9a6`](https://github.com/LunarHUE/forms/commit/d49c9a6bfa0c860365c1a5a916eb2d3580a1fe7a), [`337d9d1`](https://github.com/LunarHUE/forms/commit/337d9d115ca45f547b2af8fa7a9339d3d5ac32fe), [`cf1b97e`](https://github.com/LunarHUE/forms/commit/cf1b97e89a1e38823fa7769dc998d731f5b04f7e), [`77c06c5`](https://github.com/LunarHUE/forms/commit/77c06c50056bcd21bc855859d79e154a300e56d2), [`5ec1188`](https://github.com/LunarHUE/forms/commit/5ec1188843336c8f0a61702c43c2126e0a827711), [`72b0b6b`](https://github.com/LunarHUE/forms/commit/72b0b6bd7fef643d6dbdd15bd95bf4a01507073f), [`fc15100`](https://github.com/LunarHUE/forms/commit/fc151007a8e9f36de4326d20acbb5c3af13f00b0), [`315ff3d`](https://github.com/LunarHUE/forms/commit/315ff3d6345bf1b25716656d71dd3ad2d97f0bc9), [`17da5a8`](https://github.com/LunarHUE/forms/commit/17da5a8d1665e2f6cb5a63d080cb28b642516808), [`eaf3086`](https://github.com/LunarHUE/forms/commit/eaf308667e141235a66b8859e69e9dd16290d535), [`8919bef`](https://github.com/LunarHUE/forms/commit/8919bef7a9b919ffffe2de019b0c72b83806c78f), [`5533930`](https://github.com/LunarHUE/forms/commit/55339305450e1bc4c0999c5c54172f28fde017dc)]:
  - @lunarhue/forms-core@0.2.0
