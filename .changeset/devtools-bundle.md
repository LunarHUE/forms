---
"@lunarhue/forms-devtools": minor
---

The devtools panel has a Bundle tab listing core, the adapter and every plugin on the form. Sizes stay empty until a bundler plugin defines `__LUNARHUE_FORMS_SIZES__` as the URL of a size report, which the tab then fetches and matches to its rows. The package exports the report's types, `SizeReport` and `SizePart`.
