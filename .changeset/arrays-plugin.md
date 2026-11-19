---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

The array commands `push`, `insert`, `remove` and `move` moved into a new `arrays()` plugin, so a form that never adds, removes or reorders rows no longer ships them. That saves about 450 B brotli on every such form. A form that uses them pays about 150 B more than before.

Rendering a list needs no plugin. `Items`, `useItems`, `createItems` and `setValue` on an array work as before.

Without `arrays()`, calling a command on an array handle or field is a type error that names `arrays()`. Code without types throws `arrays:missing` in development, and the commands do nothing in production. Each row's key is then its position (`k0`, `k1`, ...), so a row's handle and state, such as touched, belong to the position. If `setValue` shortens a list and a later write lengthens it again, the rows past the old end come back under their old keys with their old state. With `arrays()` they stay gone and new rows get new keys, as before.

To migrate, add `arrays()` to every form that calls an array command:

```ts
import { arrays } from "@lunarhue/forms-react/plugins"; // or "@lunarhue/forms-solid/plugins"

const forms = createForms({ plugins: [arrays()] });
```

You can also put it in a single definition's `plugins`. A component that calls a command on a field it is given says so in its type, as `ArrayHandle<string[], FormError, "arrays">`. It then fits only forms with `arrays()`. A plugin whose setup calls the commands should list it in `requires`.

`PluginContext.store` is now typed with the names of the plugin's `requires`, so such a plugin gets the commands in its types.
