---
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

New `elementsOf(handle)` and `fieldOf(element)` exports. `elementsOf` lists the elements a field's ref got that are still in the document, in document order. `fieldOf` goes the other way and returns the field's handle, the same object `store.fieldAt(path)` gives. It doesn't look at ancestors, so walk `parentElement` or `event.composedPath()` from an element inside a custom input.

`fieldOf` works in development only for now and returns `undefined` in production, where the map behind it isn't built. Production bundles that don't import these stay the same size.
