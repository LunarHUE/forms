---
"@lunarhue/forms-core": patch
---

A write a plugin queues from `onSubmitted` is now applied when the hook returns, with one notification. Before, it waited for the next write from anywhere else.
