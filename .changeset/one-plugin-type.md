---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
"@lunarhue/forms-schema": minor
---

`dirty` and `changes()` exist in the types only on forms with `dirty()`. Reading `dirty` from a form or field snapshot, from `useField`, `useFormState`, a `Field`, `form.State` or the Solid readers, or calling `store.changes()`, is a type error without it, and so is giving `equals`. The snapshots still hold `dirty: false` at runtime. In development `changes()` without `dirty()` now throws `dirty:missing` instead of logging `dirty:untracked`, and in production it returns an empty list.

Stores, handles, snapshots and the adapters' field types take the installed plugin names as a new last type parameter. A component that reads `dirty` from its field types it as `FieldApi<string, typeof dirty>` and then fits only forms with `dirty()`. `AnyFormStore<E, "dirty">` is a store of any form that has it.

One `Plugin<A, N, M, F, S>` type replaces `Plugin`, `HookPlugin`, `SchemaPlugin`, `DirtyPlugin`, `AnyPlugin` and `AnyHookPlugin`. Use `Plugins` for a list of any plugins. `defineSchemaPlugin(adapter)` is gone. Write `definePlugin({ name, schema: adapter })`.

A plugin with field or form meta must give `initialMeta` or `initialFormMeta`, so its `meta` and `formMeta` readers never return `undefined`. Meta with no sensible start puts `undefined` in its type and starts from `initialMeta: undefined`.

`IfDirty`, `HasDirty` and `EqualsNeedsDirty` are replaced by one `Needs` type. `HasSchemaPlugin`, `PluginSchemas`, `MetaSource`, `When` and `PluginDefinition` are no longer exported. `PluginNames` and `PluginsOf` are new exports.

`FormStore<V, FormError>` no longer fits a parameter typed `FormStore<V, unknown>`. Make such a helper generic over the error type.
