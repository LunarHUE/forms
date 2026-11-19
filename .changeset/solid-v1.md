---
"@lunarhue/forms-solid": minor
---

`@lunarhue/forms-solid/v1` is a working Solid 1 adapter for `solid-js` 1.8 and later. It exports the same functions and types as the main entry and is built from the same source, so moving a form between Solid 1 and Solid 2 means changing the import.

```tsx
import { createForm, createForms, inputProps } from "@lunarhue/forms-solid/v1";
```

`./v1` doesn't need `@solidjs/web`, which is an optional peer. Solid 1 applies writes at once, while Solid 2 batches them until the next flush, so code that counts renders or effect runs can see more of them on Solid 1.

`signal()` from `@lunarhue/forms-bind` needs Solid 2. On Solid 1, bind a store with `bind()` from `@lunarhue/forms-solid/plugins`.
