# @lunarhue/forms-devtools

Devtools for [forms](https://github.com/LunarHUE/forms). Install the plugin on
the forms you want to inspect and a panel opens on the page.

```sh
npm install -D @lunarhue/forms-devtools
```

```ts
import { createForms } from "@lunarhue/forms-react";
import { devtools } from "@lunarhue/forms-devtools";

const forms = createForms({ plugins: [import.meta.env.DEV && devtools()] });
```

`dev && devtools()` leaves the plugin out of production builds. The plugin
itself never reads `NODE_ENV`, so a site that wants the panel in production,
such as a docs site, can install it there too.

| Option | |
| --- | --- |
| `enabled` | `true` (the default), `false`, or a function read when the form mounts, after each write and on `syncDevtools()`. The panel shows while any form's reads true, and loads as its own chunk the first time one does. |
| `onDisable` | Puts "Turn off devtools" in the panel, which calls it. Set what `enabled` reads to false there. |

```ts
devtools({ enabled: () => location.search.includes("devtools") });
```

Call `syncDevtools()` after changing what `enabled` reads outside a form
write, such as from a keyboard shortcut.

Installing the plugin also calls `trackElements()` from the adapter, so
`fieldOf(element)` works in production from then on.

## The panel

The panel docks in a corner of the page. Its menu moves it to another
corner, which the browser remembers for the whole site. On a phone it's a
button that opens a bottom sheet.

- The form chip lists the forms on the page by their store `id`, numbered
  when two share one. Give each store an `id` to tell them apart.
- Pick mode outlines each form on the page. Click one to inspect it.
- The Fields tab shows the value tree, with each field's flags (`dirty` only
  when the form has `dirty()`). Select a row to see its stable path, value
  against baseline, display text, errors by where they came from, the
  plugins attached there and its last write. "Invalid only" lists just the
  fields with errors.
- The Log tab lists the form's writes and submissions in the order they
  happened, newest first, each write with its cause: `user`, `reset`,
  `rebase` or the plugin's name. A submission that a reset ended shows as
  `aborted`. The log keeps the last 500 of each and starts when the panel
  turns on.
- The Plugins tab lists every plugin on the form in the order their hooks
  run, with each one's form meta and the keys of its API on `store.plugins`.
- The inspect button, or holding Alt, shows a card with a field's facts for
  the input under the pointer. A radio group's radios all find their one
  field, and a custom input finds its field once it has the adapter's field
  ref (`useFieldRef` in React, `fieldRef` in Solid). Click to pin the card
  and select the field's row. The click never reaches the page. Escape ends
  inspecting and unpins.
- Hovering a row of the Fields tab outlines the field's elements on the page.

Vue doesn't record elements yet, so a Vue form has no inspect button and no
outlines.

An error that one of our packages raised shows as its code, linked to its
entry on the [errors page](https://forms.lunarhue.dev/errors).

The panel renders in a shadow root, so the page's styles and its own stay
apart. It is one chunk, with Preact bundled in, and an app doesn't install
Preact. While it's open it reads the forms on each animation frame and never
subscribes to a store, so it never keeps a plugin's `onActive` running.
