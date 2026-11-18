---
"@lunarhue/forms-core": patch
---

A plugin can now write from the cleanup its `onActive` returns. The write runs when the last listener goes, and `onWrite` observers get its records with the plugin as the cause. Before, a `ctx.write` from that cleanup waited for the next write to the store, which might never come.
