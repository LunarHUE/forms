# @lunarhue/forms-bind

Bindings between a [forms](https://github.com/LunarHUE/forms) form and a store you own.

A binding never replaces the form's store. The form keeps its own values,
errors and touched flags. The binding copies the value both ways: a change in
the form goes out to your store, and a change in your store comes into the
form.

```sh
npm install @lunarhue/forms-bind
```

You also need an adapter, `@lunarhue/forms-react` or `@lunarhue/forms-solid`.

| Plugin | Import | Binds to |
| --- | --- | --- |
| `zustand()` | `@lunarhue/forms-bind/zustand` | a Zustand 5 store |
| `signal()` | `@lunarhue/forms-bind/solid` | a Solid 2 signal |

Working examples:
[Zustand](https://forms.lunarhue.dev/react/integrations/zustand) and
[Solid signals](https://forms.lunarhue.dev/solid/integrations/solid-signals) on the docs site.

To bind to anything else, use `bind()` from your adapter's `plugins/bind`
entry. The [main README](https://github.com/LunarHUE/forms#readme) has the plugin guide.

MIT licensed.
