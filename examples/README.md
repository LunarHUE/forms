# Examples

Small forms that show what the API looks like. Each file is one idea and
reads top to bottom: the schema or default values, `createForms`, `define`,
and one component that renders the form.

These are for reading. Nothing here is rendered, run or tested. The root
`typecheck` script checks every file, so the code stays in step with the
library, and `lint` covers them too.

## Layout

`react` (`@lunarhue/forms-example-react`) and `solid`
(`@lunarhue/forms-example-solid`) are private workspace packages, one per
adapter. They have the same files:

| File                   | What it shows                                                  |
| ---------------------- | -------------------------------------------------------------- |
| `basic.tsx`            | A schema, field components, a fieldset and a submit button     |
| `readme.tsx`           | The root README's example, exactly as it appears there (React) |
| `arrays.tsx`           | A list of rows with push, remove and move                      |
| `async-validation.tsx` | A debounced server check on a username                         |
| `rules.tsx`            | Fields disabled or hidden from another field's value           |
| `history.tsx`          | Undo and redo buttons                                          |
| `mask.tsx`             | A phone number shown formatted and stored as digits            |
| `persist.tsx`          | A draft kept in `localStorage` across reloads                  |
| `bind.tsx`             | The form kept in step with a zustand store, or a Solid signal  |
| `dirty.tsx`            | A save button enabled only when something changed              |

Each file default-exports its form component, which would work if you
mounted it.

There is no Vue example yet.

## Elsewhere

- The inspector, the dev panel that shows a form store as it changes, is
  parked in `parked/inspector` until the docs site can render these forms
  with it beside them.
- Browser tests don't live here. They belong in a separate suite that runs
  the same checks against every adapter, tracked in issue #69.
