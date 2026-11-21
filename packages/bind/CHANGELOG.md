# @lunarhue/forms-bind

## 0.2.0

### Minor Changes

- [#288](https://github.com/LunarHUE/forms/pull/288) [`42c6cbc`](https://github.com/LunarHUE/forms/commit/42c6cbc98f9a20584d0dbce81db136fcf0770ac7) Thanks [@tristendillon](https://github.com/tristendillon)! - `zustand()` with a slice hands `update` the store's state as a second argument, so a slice inside a map can keep its sibling keys: `update: (summary, state) => ({ summaries: { ...state.summaries, [key]: summary } })`. A one-argument `update` works as before.
  
  A new `isEqual` option says when two slices match, `Object.is` by default. Pass it when `select` builds a new object each time, such as `({ verdict, body }) => ({ verdict, body })`, and store changes to other fields no longer write into the form.

### Patch Changes

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

- [#198](https://github.com/LunarHUE/forms/pull/198) [`d9a1e25`](https://github.com/LunarHUE/forms/commit/d9a1e25ed487b2cf05ca93cc3a555d013b456571) Thanks [@tristendillon](https://github.com/tristendillon)! - The schema and bind declarations bundle core's types, as the adapters' do. A project that installs an adapter with `valibot()`, `zod()`, `zustand()` or `signal()` under a strict install (pnpm, Bun isolated) no longer gets TS2307 for `@lunarhue/forms-core` in the declarations it emits. Each entry also exports the type its plugin returns, `Plugin` or `BindPlugin`. Both packages' declarations grow by about 73 kB.

- [#292](https://github.com/LunarHUE/forms/pull/292) [`d11751d`](https://github.com/LunarHUE/forms/commit/d11751d74a70ec88f404cad483255fab52619157) Thanks [@tristendillon](https://github.com/tristendillon)! - Fix `zustand()` overload inference when combining slice options (`select` / `update` / `isEqual`) with shared options (`incoming` / `initial`), so `state`, `value`, `previous`, and `next` are inferred without explicit type arguments.
- Updated dependencies [[`ce5885d`](https://github.com/LunarHUE/forms/commit/ce5885dbcda65cc5ad731e86f03552722160d326), [`5638f90`](https://github.com/LunarHUE/forms/commit/5638f90b0f0fd0d6e11d9db18c66915c3678b3a9), [`bcc99bb`](https://github.com/LunarHUE/forms/commit/bcc99bb76683bd4febf4886039768095712a00a2), [`23b8bef`](https://github.com/LunarHUE/forms/commit/23b8bef0e6d6803cce628a4e9b7e77da56f9101d), [`c4e1b11`](https://github.com/LunarHUE/forms/commit/c4e1b118d010229149d0b04033ae0de3e805e580), [`c8a59a2`](https://github.com/LunarHUE/forms/commit/c8a59a212b4d50ec7b1b7ec3fbefef6a1ea2ba29), [`2ee8b18`](https://github.com/LunarHUE/forms/commit/2ee8b1877629cf80125ee4158c666a3d911834cd), [`d6b2008`](https://github.com/LunarHUE/forms/commit/d6b2008ebfa9fc033a71e027b8b3e4d49f06c96d), [`b96e3b5`](https://github.com/LunarHUE/forms/commit/b96e3b53fb909bb0b989ba85bba2dcc99e767757), [`d49c9a6`](https://github.com/LunarHUE/forms/commit/d49c9a6bfa0c860365c1a5a916eb2d3580a1fe7a), [`337d9d1`](https://github.com/LunarHUE/forms/commit/337d9d115ca45f547b2af8fa7a9339d3d5ac32fe), [`cf1b97e`](https://github.com/LunarHUE/forms/commit/cf1b97e89a1e38823fa7769dc998d731f5b04f7e), [`77c06c5`](https://github.com/LunarHUE/forms/commit/77c06c50056bcd21bc855859d79e154a300e56d2), [`5ec1188`](https://github.com/LunarHUE/forms/commit/5ec1188843336c8f0a61702c43c2126e0a827711), [`72b0b6b`](https://github.com/LunarHUE/forms/commit/72b0b6bd7fef643d6dbdd15bd95bf4a01507073f), [`fc15100`](https://github.com/LunarHUE/forms/commit/fc151007a8e9f36de4326d20acbb5c3af13f00b0), [`315ff3d`](https://github.com/LunarHUE/forms/commit/315ff3d6345bf1b25716656d71dd3ad2d97f0bc9), [`17da5a8`](https://github.com/LunarHUE/forms/commit/17da5a8d1665e2f6cb5a63d080cb28b642516808), [`eaf3086`](https://github.com/LunarHUE/forms/commit/eaf308667e141235a66b8859e69e9dd16290d535), [`8919bef`](https://github.com/LunarHUE/forms/commit/8919bef7a9b919ffffe2de019b0c72b83806c78f), [`5533930`](https://github.com/LunarHUE/forms/commit/55339305450e1bc4c0999c5c54172f28fde017dc)]:
  - @lunarhue/forms-core@0.2.0

## 0.1.1

### Patch Changes

- [#147](https://github.com/LunarHUE/forms/pull/147) [`c28690d`](https://github.com/LunarHUE/forms/commit/c28690d0922a9bc9e10b4ea8c741e785ac29bae9) Thanks [@tristendillon](https://github.com/tristendillon)! - Require the stable Solid 2 release. The `solid-js` and `@solidjs/web` peer ranges now start at `2.0.0`, so the 2.0 release candidates no longer satisfy them.

- [#113](https://github.com/LunarHUE/forms/pull/113) [`fbe4cf7`](https://github.com/LunarHUE/forms/commit/fbe4cf7dac777fa1fc439c60dcc08b65ccf1fda3) Thanks [@dependabot](https://github.com/apps/dependabot)! - The zustand binding is now built and tested against zustand 5.1. The peer range is still `^5.0.0`, so nothing changes for 5.0 users.
- Updated dependencies [[`c7cbf4e`](https://github.com/LunarHUE/forms/commit/c7cbf4eee7bd0420d04cb2eaf250669760c21625), [`0c7648c`](https://github.com/LunarHUE/forms/commit/0c7648cd871cd78d73204347c81a4a7bb29e7de7), [`094145b`](https://github.com/LunarHUE/forms/commit/094145b751fc9510f112510d52a9d046c1ecf439), [`ab94acc`](https://github.com/LunarHUE/forms/commit/ab94acc9a9375d0b81138b59d0e87cfac3644e47)]:
  - @lunarhue/forms-core@0.1.1

## 0.1.0

### Minor Changes

- [#119](https://github.com/LunarHUE/forms/pull/119) [`e180e75`](https://github.com/LunarHUE/forms/commit/e180e752ac61ca2651b18acb36c5eef43b7e8add) Thanks [@tristendillon](https://github.com/tristendillon)! - First release.

### Patch Changes

- Updated dependencies [[`855500b`](https://github.com/LunarHUE/forms/commit/855500be2a57836db9c67729e7942446ac073b54), [`e180e75`](https://github.com/LunarHUE/forms/commit/e180e752ac61ca2651b18acb36c5eef43b7e8add)]:
  - @lunarhue/forms-core@0.1.0
