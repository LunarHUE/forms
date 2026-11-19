# Inspector

A dev panel that shows a form store as it changes: the form state, a table
with one row per field and its flags and errors, the list of changed
fields, and a log of every change. Its controls reset, validate and submit
the form, and toggle a field's `disabled` and `readOnly`.

- `mountInspector(element, store, options)` in `src/inspector.ts` renders
  it in plain DOM, so any framework can mount it. It returns the function
  that removes it.
- `Inspector` in `src/react.tsx`, the `./react` entry, is the React
  wrapper. It mounts the panel after the first commit.
- `src/styles.css` styles both.
- `createServerSettings` in `src/settings.ts` holds the state behind the
  optional "slow network" and "server rejects next save" toggles. A page
  with a fake server passes it in and reads it there.

Nothing uses it today. It used to sit beside the example apps, which became
the docs site's demos in `apps/docs/src/demos`. It is waiting for the docs
site's devtools, which will show each demo's form with this panel beside it.

The root `typecheck` and `test` scripts still cover it, so it keeps working
while it waits.
