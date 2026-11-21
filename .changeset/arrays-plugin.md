---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

Lists moved into a new `arrays()` plugin. It brings item keys that follow the items and the array commands `push`, `insert`, `remove` and `move`. `Items`, `useItems` and `createItems` take only array handles of forms that have it. A form with no lists no longer ships any of this, which saves about 550 B brotli. A form with a list pays about 150 B more than before.

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
