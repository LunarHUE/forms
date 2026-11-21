# @lunarhue/forms-schema

## 0.2.0

### Minor Changes

- [#182](https://github.com/LunarHUE/forms/pull/182) [`d6b2008`](https://github.com/LunarHUE/forms/commit/d6b2008ebfa9fc033a71e027b8b3e4d49f06c96d) Thanks [@tristendillon](https://github.com/tristendillon)! - `dirty` and `changes()` exist in the types only on forms with `dirty()`. Reading `dirty` from a form or field snapshot, from `useField`, `useFormState`, a `Field`, `form.State` or the Solid readers, or calling `store.changes()`, is a type error without it, and so is giving `equals`. The snapshots still hold `dirty: false` at runtime. In development `changes()` without `dirty()` now throws `dirty:missing` instead of logging `dirty:untracked`, and in production it returns an empty list.
  
  Stores and snapshots take the installed plugin names as a new last type parameter. Handles and the adapters' field types take the plugins by factory, before the error type. A component that reads `dirty` from its field types it as `FieldApi<string, typeof dirty>` and then fits only forms with `dirty()`. `AnyFormStore<E, "dirty">` is a store of any form that has it.
  
  One `Plugin<A, N, M, F, S>` type replaces `Plugin`, `HookPlugin`, `SchemaPlugin`, `DirtyPlugin`, `AnyPlugin` and `AnyHookPlugin`. Use `Plugins` for a list of any plugins. `defineSchemaPlugin(adapter)` is gone. Write `definePlugin({ name, schema: adapter })`.
  
  A plugin with field or form meta must give `initialMeta` or `initialFormMeta`, so its `meta` and `formMeta` readers never return `undefined`. Meta with no sensible start puts `undefined` in its type and starts from `initialMeta: undefined`.
  
  `IfDirty`, `HasDirty` and `EqualsNeedsDirty` are replaced by one `Needs` type. `HasSchemaPlugin`, `PluginSchemas`, `MetaSource`, `When` and `PluginDefinition` are no longer exported. `PluginNames` and `PluginsOf` are new exports.
  
  `FormStore<V, FormError>` no longer fits a parameter typed `FormStore<V, unknown>`. Make such a helper generic over the error type.

- [#166](https://github.com/LunarHUE/forms/pull/166) [`eaf3086`](https://github.com/LunarHUE/forms/commit/eaf308667e141235a66b8859e69e9dd16290d535) Thanks [@tristendillon](https://github.com/tristendillon)! - Validation is built into core again. A form with no plugins can take `validate` on its definition and a `validate` prop on a field, and `field.validate()` and `registerValidator` work instead of throwing.
  
  `validation()` is gone, along with the `plugins/validation` entry of core, React and Solid. Drop it from your `plugins` list. `defineSchemaPlugin` moved to `@lunarhue/forms-core/plugins`. Schema plugins such as `valibot()` and `zod()` now only give a schema's default values. A schema whose library has no plugin installed still needs complete `defaultValues`, and leaving them out is a type error that names `NoSchemaPlugin`.
  
  Removed types: `IfValidation`, `HasValidation`, `ValidationNotInstalled`, `SchemaNeedsValidation`, `ValidationPlugin`, and `ValidatePropFor` in the adapters. `Scope` and `Fieldset` in the adapters lose their plugin type parameter, and so do the bound component types under them. The `validation:definition` and `validation:validator` errors are gone.
  
  The main entry of core grows by about 1.9 kB brotli, since it now carries the runner.

### Patch Changes

- [#198](https://github.com/LunarHUE/forms/pull/198) [`d9a1e25`](https://github.com/LunarHUE/forms/commit/d9a1e25ed487b2cf05ca93cc3a555d013b456571) Thanks [@tristendillon](https://github.com/tristendillon)! - The schema and bind declarations bundle core's types, as the adapters' do. A project that installs an adapter with `valibot()`, `zod()`, `zustand()` or `signal()` under a strict install (pnpm, Bun isolated) no longer gets TS2307 for `@lunarhue/forms-core` in the declarations it emits. Each entry also exports the type its plugin returns, `Plugin` or `BindPlugin`. Both packages' declarations grow by about 73 kB.
- Updated dependencies [[`ce5885d`](https://github.com/LunarHUE/forms/commit/ce5885dbcda65cc5ad731e86f03552722160d326), [`5638f90`](https://github.com/LunarHUE/forms/commit/5638f90b0f0fd0d6e11d9db18c66915c3678b3a9), [`bcc99bb`](https://github.com/LunarHUE/forms/commit/bcc99bb76683bd4febf4886039768095712a00a2), [`23b8bef`](https://github.com/LunarHUE/forms/commit/23b8bef0e6d6803cce628a4e9b7e77da56f9101d), [`c4e1b11`](https://github.com/LunarHUE/forms/commit/c4e1b118d010229149d0b04033ae0de3e805e580), [`c8a59a2`](https://github.com/LunarHUE/forms/commit/c8a59a212b4d50ec7b1b7ec3fbefef6a1ea2ba29), [`2ee8b18`](https://github.com/LunarHUE/forms/commit/2ee8b1877629cf80125ee4158c666a3d911834cd), [`d6b2008`](https://github.com/LunarHUE/forms/commit/d6b2008ebfa9fc033a71e027b8b3e4d49f06c96d), [`28e77e2`](https://github.com/LunarHUE/forms/commit/28e77e2f0aad148a583de4316ab4209e2fe1a9f1), [`b96e3b5`](https://github.com/LunarHUE/forms/commit/b96e3b53fb909bb0b989ba85bba2dcc99e767757), [`d49c9a6`](https://github.com/LunarHUE/forms/commit/d49c9a6bfa0c860365c1a5a916eb2d3580a1fe7a), [`337d9d1`](https://github.com/LunarHUE/forms/commit/337d9d115ca45f547b2af8fa7a9339d3d5ac32fe), [`cf1b97e`](https://github.com/LunarHUE/forms/commit/cf1b97e89a1e38823fa7769dc998d731f5b04f7e), [`77c06c5`](https://github.com/LunarHUE/forms/commit/77c06c50056bcd21bc855859d79e154a300e56d2), [`5ec1188`](https://github.com/LunarHUE/forms/commit/5ec1188843336c8f0a61702c43c2126e0a827711), [`72b0b6b`](https://github.com/LunarHUE/forms/commit/72b0b6bd7fef643d6dbdd15bd95bf4a01507073f), [`fc15100`](https://github.com/LunarHUE/forms/commit/fc151007a8e9f36de4326d20acbb5c3af13f00b0), [`315ff3d`](https://github.com/LunarHUE/forms/commit/315ff3d6345bf1b25716656d71dd3ad2d97f0bc9), [`17da5a8`](https://github.com/LunarHUE/forms/commit/17da5a8d1665e2f6cb5a63d080cb28b642516808), [`eaf3086`](https://github.com/LunarHUE/forms/commit/eaf308667e141235a66b8859e69e9dd16290d535), [`8919bef`](https://github.com/LunarHUE/forms/commit/8919bef7a9b919ffffe2de019b0c72b83806c78f), [`5533930`](https://github.com/LunarHUE/forms/commit/55339305450e1bc4c0999c5c54172f28fde017dc)]:
  - @lunarhue/forms-core@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`c7cbf4e`](https://github.com/LunarHUE/forms/commit/c7cbf4eee7bd0420d04cb2eaf250669760c21625), [`0c7648c`](https://github.com/LunarHUE/forms/commit/0c7648cd871cd78d73204347c81a4a7bb29e7de7), [`094145b`](https://github.com/LunarHUE/forms/commit/094145b751fc9510f112510d52a9d046c1ecf439), [`ab94acc`](https://github.com/LunarHUE/forms/commit/ab94acc9a9375d0b81138b59d0e87cfac3644e47)]:
  - @lunarhue/forms-core@0.1.1

## 0.1.0

### Minor Changes

- [#119](https://github.com/LunarHUE/forms/pull/119) [`e180e75`](https://github.com/LunarHUE/forms/commit/e180e752ac61ca2651b18acb36c5eef43b7e8add) Thanks [@tristendillon](https://github.com/tristendillon)! - First release.

### Patch Changes

- Updated dependencies [[`855500b`](https://github.com/LunarHUE/forms/commit/855500be2a57836db9c67729e7942446ac073b54), [`e180e75`](https://github.com/LunarHUE/forms/commit/e180e752ac61ca2651b18acb36c5eef43b7e8add)]:
  - @lunarhue/forms-core@0.1.0
