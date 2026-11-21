---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

Plugins and parts get an `onBlur(path)` hook. It runs on every blur through a field's `handleBlur`, not only the first one that sets `touched`, so a plugin can save or clean up a field each time the user leaves it. It runs inside the blur's batch, after the field is touched and its blur validators ran, and writes it makes through `ctx.write` land in that batch. `setTouched(true)` doesn't run it. A part gets only the blurs at or below its path. Forms without hook plugins or parts don't grow.
