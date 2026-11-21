---
"@lunarhue/forms-bind": minor
---

`zustand()` with a slice hands `update` the store's state as a second argument, so a slice inside a map can keep its sibling keys: `update: (summary, state) => ({ summaries: { ...state.summaries, [key]: summary } })`. A one-argument `update` works as before.

A new `isEqual` option says when two slices match, `Object.is` by default. Pass it when `select` builds a new object each time, such as `({ verdict, body }) => ({ verdict, body })`, and store changes to other fields no longer write into the form.
