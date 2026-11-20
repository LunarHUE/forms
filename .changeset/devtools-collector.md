---
"@lunarhue/forms-devtools": minor
---

New package `@lunarhue/forms-devtools`, with the `devtools()` plugin and `syncDevtools()`. Each form with the plugin registers with the page while it is mounted, and the plugin logs its last 500 writes and its submissions. `enabled` decides whether the panel shows, and the panel loads as a chunk of its own the first time a form's `enabled` reads true. The panel is empty for now. `dev && devtools()` leaves all of it out of production.
