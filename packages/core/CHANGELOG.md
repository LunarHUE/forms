# @lunarhue/forms-core

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
