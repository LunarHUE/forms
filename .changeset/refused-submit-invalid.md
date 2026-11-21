---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

A submit whose `onSubmit` leaves errors on the form with `setErrors` now ends `"invalid"`, not `"succeeded"`. That is how the docs say to handle a server that refuses the save, and nothing was saved, so it no longer reads as a success. `baselineOnSubmit()` leaves the refused values dirty instead of taking them as the baseline, and React and Solid move focus to the first field the server refused, as they do after a failed validation.

Validation errors don't count, so a field the user breaks while the save runs doesn't turn a real save into a refusal. Errors cleared before `onSubmit` returns don't count either.

When upgrading:

- Code that set errors in `onSubmit` and then checked for `"succeeded"`, or read a message from its `result`, now sees `{ status: "invalid" }` with no result. Show the refusal from the errors you set, such as the root's errors for a `form` message.
- A plugin's `onSubmitted` gets the submitted value as `input` for such a submit, though its status is `"invalid"`. It is still undefined when validation or a plugin stopped the submit.
- To focus the refused field you no longer need to call `store.firstInvalid()` after the submit. Pass `focusOnInvalid: false` to keep focus where it was.
