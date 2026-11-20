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

## Bundle sizes

The Vite plugin measures your production build for the Bundle tab:

```ts
// vite.config.ts
import { formsDevtools } from "@lunarhue/forms-devtools/vite";

export default defineConfig({ plugins: [formsDevtools()] });
```

`vite build` writes the report to `lunarhue-forms-sizes.json` at the root of
the output, and the panel reads it from there. In `vite dev`, the plugin
builds your app for production on a worker thread when the server starts, and
again a second after your source stops changing. That build writes nothing.
The dev server serves the report and tells open pages when a new one is
ready. Until the first build finishes, the tab shows no sizes.

The plugin splits the minified chunks by their source maps. Each byte counts
for the package its module comes from, and in core for the plugin file it
comes from. A core module that only one plugin imports, such as the mask's
caret helpers, counts for that plugin. One that several plugins share counts
for core. A plugin your forms don't import isn't in the build, so it isn't in
the report. A third-party plugin has no part, since the plugin can't tell its
code from the rest of your app. If your build has no source maps, the plugin
makes hidden ones and drops them before writing.

A framework that hands Vite its config inline, like Astro, leaves the dev
server no config file to build the app again from. There the plugin builds
what your modules import from the forms packages, once the browser has loaded
them, and the total covers only that build. `vite build` (`astro build`)
measures the whole app.

Vite 8 is an optional peer dependency.

## The panel

The panel docks in a corner of the page. Its menu moves it to another
corner, which the browser remembers for the whole site. On a phone it's a
button that opens a bottom sheet.

- While the panel is on, a dashed outline marks each form on the page, with
  the form's name on a tag above it. Click the tag to select the form. The
  outline lets clicks through to the form.
- The form chip lists the forms on the page by their store `id`, numbered
  when two share one. A form whose `id` the adapter made up, such as React's
  `useId`, shows as `form 2` for the second form on the page. Give each store
  an `id` to name it.
- The Fields tab shows the value tree. Each row's flags are icons: invalid,
  validating, dirty (only when the form has `dirty()`), edited, touched,
  disabled and read-only. Hover or focus one to see what it means and its
  detail: errors by where they came from for invalid, baseline against value
  for dirty, the last write for edited. The pointer button on a row scrolls
  the field's element into view. Select a row to see its value, its baseline
  and its last writes, each with its cause. The filter box above the tree
  lists the fields whose name contains the text, and its toggle lists just
  the fields with errors.
- The bar shows how the selected form's last submission went, such as
  `submit failed`, once the form has submitted.
- The Log tab lists the form's writes and submissions in the order they
  happened, newest first, each write with its cause: `user`, `reset`,
  `rebase` or the plugin's name. A submission that a reset ended shows as
  `aborted`. The log keeps the last 500 of each and starts when the panel
  turns on.
- The Plugins tab lists every plugin on the form in the order their hooks
  run, with each one's form meta and the keys of its API on `store.plugins`.
- The inspect button, or holding Alt, shows a card with a field's value,
  baseline and writes for the input under the pointer. A radio group's
  radios all find their one field, and a custom input finds its field once
  it has the adapter's field ref (`useFieldRef` in React, `fieldRef` in
  Solid). Hovering a field's label counts as hovering the field. Click to
  pin the card and select the field's row. The click never reaches the page,
  and inspecting stays on, so the next click pins another field. Escape
  unpins the card; the inspect button turns inspecting off.
- Hovering a row of the Fields tab outlines the field's elements on the page.
- The Bundle tab draws what the forms packages add to the build as bars:
  their total, then core, the adapter and the plugins, then each plugin.
  Below that it lists the plugins in the order their hooks run. Sizes come
  from your production build, so the bars are even and show no sizes until
  the Vite plugin below measures it. Each part shows minified bytes.
  Compressed bytes don't add up across parts, so only the whole app's total
  has a gzip size. `devtools()` stays out of the bars, since a production
  build usually leaves it out.

Vue doesn't record elements yet, so a Vue form has no inspect button and no
outlines.

An error that one of our packages raised shows as its code, linked to its
entry on the [errors page](https://forms.lunarhue.dev/errors).

The panel renders in a shadow root, so the page's styles and its own stay
apart. It is one chunk, with Preact bundled in, and an app doesn't install
Preact. While it's open it reads the forms on each animation frame and never
subscribes to a store, so it never keeps a plugin's `onActive` running.
