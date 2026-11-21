---
"@lunarhue/forms-core": minor
---

`store.reset({ values })` sets new values and makes them the baseline in one step, and clears touched, edited and error state as `reset()` does. Use it after a save or a refetch when the user's edits should go: with `dirty()` the form is clean afterwards, and a later `reset()` comes back to these values. It works in `/mini` too.
