# @lunarhue/forms-core

The framework-free core of [forms](https://github.com/LunarHUE/forms): values, arrays, submit and the plugin
host, plus the plugins that need no other library.

You rarely install this yourself. The React and Solid adapters depend on it
and re-export everything you need, plugins included:

```sh
npm install @lunarhue/forms-react   # or @lunarhue/forms-solid
```

Install core directly when you write an adapter or publish a plugin.

```sh
npm install @lunarhue/forms-core
```

## Plugins in this package

Each has its own entry point, so a plugin you don't import costs no bytes.

| Entry | Plugin |
| --- | --- |
| `./plugins/validation` | `validation()`: runs validators and collects errors |
| `./plugins/dirty` | `dirty()` and `baselineOnSubmit()`: what changed since the saved values |
| `./plugins/history` | `history()`: undo and redo |
| `./plugins/mask` | `mask()`: cleans and formats what the user types |
| `./plugins/rules` | `rules()`: `disabled` and `hidden` from the rest of the form |
| `./plugins/persist` | `persist()`: saves the draft and restores it |
| `./plugins/rebase` | `rebase()`: takes fresh server data without wiping edits |
| `./plugins/bind` | `bind()`: copies the value to a store you own and back |

Write your own with `definePlugin` from `./plugins`. The rules are in
[docs/plugins.md](https://github.com/LunarHUE/forms/blob/main/docs/plugins.md).

## More

The [main README](https://github.com/LunarHUE/forms#readme) has a full example and the plugin guide.
Every error code is on [the errors page](https://forms.lunarhue.dev/errors).

MIT licensed.
