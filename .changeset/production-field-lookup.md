---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

`fieldOf(element)` now works in production for apps that opt in. Call `trackElements()` before the form renders, and from then on the adapters' refs record which field each element belongs to. Elements mounted before that call aren't recorded. Development needs no call, as before.

`trackElements(listener)` also takes a listener that gets every element a ref records or forgets, with its field handle, or its store for a `<form>` element, and the adapter's name. React before 19 doesn't say which element left, so those removals come late, the next time the adapter looks at that field's elements.

Without the call, the adapters cost about 30 to 40 B more, brotli, for the slot the refs report to.
