---
"@lunarhue/forms-core": patch
"@lunarhue/forms-react": patch
---

Trim a few code paths in the store and the React ref handling. `stats()` now returns zero counts in a production build, since only tests and leak checks read it. Nothing else changes for apps, so there's nothing to migrate.
