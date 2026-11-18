---
"@lunarhue/forms-core": patch
---

You can write a value you read from a field straight back. `setValue`, `push`, `insert` and the rebase plugin now take the readonly values that `peek()` and field objects return, so `tags.setValue(tags.peek().value)` compiles without a spread or a cast.
