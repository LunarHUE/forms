---
"@lunarhue/forms-bind": patch
---

Fix `zustand()` overload inference when combining slice options (`select` / `update` / `isEqual`) with shared options (`incoming` / `initial`), so `state`, `value`, `previous`, and `next` are inferred without explicit type arguments.
