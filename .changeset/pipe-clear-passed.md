---
"@lunarhue/forms-core": patch
---

`pipe()` now clears a previous step's error as soon as a newer run passes that step, instead of keeping the stale error visible while a later async or `debounced` step is still running. When the same step re-runs (such as a server check on a new value), its existing error stays until the new check settles.
