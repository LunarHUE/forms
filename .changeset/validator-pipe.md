---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

New `pipe(...checks)` runs validators one after another on the same value and stops at the first that returns an error. Put cheap checks before a server check, and the server check runs only once they pass:

```ts
username: pipe(
  (name) => (name.length < 3 ? { message: "Use at least 3 characters." } : undefined),
  debounced(async (name, { signal }) => ((await isTaken(name, signal)) ? { message: "That name is taken." } : undefined), 400),
),
```

While its checks answer at once, so does the pipe. A failing sync check never starts the debounced one after it, so the field doesn't show `validating`. Submit and `validate()` skip a debounce inside a pipe, even one the pipe hasn't reached yet. The checks can be field validators, form validators, Standard Schemas or wrapped checks, and a schema's issues still go through `mapError`. Wrap the pipe in `validateOn` to set its timing.
