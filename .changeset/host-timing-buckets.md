---
"@lunarhue/forms-core": patch
---

The `deferred` and `idle` delivery code moved out of the plugin host and now comes with `definePlugin`. The built-in plugins that only use `sync`, which are `mask`, `bind`, `rules`, `rebase` and `baselineOnSubmit`, no longer bring it, so a form with `mask()` and no `history()` or `persist()` is about 165 B brotli smaller. Plugins made with `definePlugin` work as before.
