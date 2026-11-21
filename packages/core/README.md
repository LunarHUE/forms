# @lunarhue/forms-core

The framework-free core of [forms](https://github.com/LunarHUE/forms): values, arrays, validation, submit
and the plugin host, plus the plugins that need no other library.

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

All of them come from `@lunarhue/forms-core/plugins`. The package has no side
effects, so your bundler drops a plugin you don't import and it costs no bytes.

| Plugin | What it does |
| --- | --- |
| `dirty()` and `baselineOnSubmit()` | What changed since the saved values |
| `arrays()` | Lists, with row keys and `push`, `insert`, `remove` and `move` |
| `history()` | Undo and redo |
| `rules()` | `disabled` and `hidden` from the rest of the form |
| `persist()` | Saves the draft and restores it |
| `rebase()` | Takes fresh server data without wiping edits |
| `bind()` | Copies the value to a store you own and back |

Masks need no plugin: `masked`, `cleaned` and `displayed` from `./text` are
parts that clean and format what the user types.

Write your own with `definePlugin` from `./plugins`, or a schema plugin for
another schema library with `definePlugin({ name, schema })`. The rules are in
[Writing a plugin](https://forms.lunarhue.dev/react/writing-plugins/first-plugin).

## More

The [main README](https://github.com/LunarHUE/forms#readme) has a full example and the plugin guide.
Every error code is on [the errors page](https://forms.lunarhue.dev/errors).

MIT licensed.
