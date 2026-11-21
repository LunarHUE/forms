---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
"@lunarhue/forms-bind": patch
---

Every first-class plugin now comes from one `plugins` entry, and the per-plugin entries are gone. Your bundler still drops the plugins you don't import, so bundles don't grow. Change your imports:

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
