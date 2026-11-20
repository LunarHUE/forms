# Comparison apps

The same forms built twice, once with `@lunarhue/forms` and once with
[TanStack Form](https://tanstack.com/form), to compare the code each needs and
what each ships. The package is private and never published.

```
<app>/lunarhue/   the app with @lunarhue/forms-react
<app>/tanstack/   the same app with @tanstack/react-form
shared/           UI pieces, CSS and the fake server both sides use
shared/specs/     one Playwright spec per app, run against both builds
apps.ts           the list of apps and libraries
sizes.json        bundle sizes, written by scripts/size-compare.ts
```

Both sides render the same markup from `shared/ui.tsx` and call the same fake
server in `shared/server.ts`, so the only code that differs is the form
wiring. Both use React, Vite and Zod from the workspace catalog. TanStack Form
is pinned to 1.33.5, the latest stable release. Our side is the workspace
build of the packages, published as 0.2.0.

## The apps

**Sign-up** (`signup/`). Email, username, password, confirmation and a terms
checkbox. Errors show after a field's first blur and then follow every
input. The confirmation is checked against the password. The username goes to
the server after a 400 ms pause, and a newer check aborts the older one. The
server can refuse the email, and that message shows on the field until the
user edits it. Our side uses core only: `validate.fields`, `validate.form`,
registered field components and `setErrors`. TanStack's uses
`createFormHook`, field validators, `onChangeListenTo` and a form-level
`onSubmitAsync`.

Where the TanStack version needed a choice of its own:

- TanStack keeps an `onBlur` error until the next blur, even after the user
  fixes the value. The checks are listed under `onChange` only, and the field
  components run them on blur with `field.validate("change")`.
- `isTouched` turns true on the first keystroke, so the components wait for
  `isBlurred` before showing errors.
- The username request runs under `onChangeAsync`, which TanStack calls on
  every change. The validator returns early until the field has been blurred,
  so no request goes out before the first blur, as on our side.
- A submit while a check is pending, its debounce included, does nothing. The
  submit button follows `canSubmit`, the pattern TanStack's docs use, so it
  is disabled until checks settle and while a touched form is invalid. Ours
  stays enabled and a submit waits for the check.
- The server call runs in the form's `onSubmitAsync` validator, which is how
  TanStack's docs put server errors on fields. `onSubmit` only shows the
  welcome message, kept in React state since TanStack's submit has no result.

**Profile settings** (`profile/`). Name, email, bio, time zone and a nested
`notifications` object, checked by a Zod schema and loaded from the server
first. Each changed field is marked, and typing the original back clears the
mark. Save is disabled while nothing changed. After a save the form is clean,
except for fields edited while the save ran. Refresh takes the server's copy
for unchanged fields and keeps the changed ones. Discard goes back to the last
saved or refreshed copy. Our side uses `zod()`, `dirty()`,
`baselineOnSubmit()`, `rebase()` and `store.changes()`. TanStack's uses its
Standard Schema support, `isDefaultValue`, `form.reset`, `formOptions` and
`withForm`.

Where the TanStack version needed a choice of its own:

- `isDirty` stays true once the user types, even when they type the original
  back. The mark and the change count read `isDefaultValue` instead.
- TanStack has no way to move the defaults and keep some values. A small
  helper, `rebaseline`, reads the fields to keep, calls `form.reset(values)`,
  and writes the kept ones back. The save and Refresh both use it, with a
  hand-kept list of the form's fields to walk.
- `useForm` applies its options again on every render, and an untouched form
  takes new `defaultValues` as its values, so defaults moved with
  `form.reset(values)` would snap back on the next render. The form keeps its
  defaults in React state and moves them after every save and refresh.
  Refresh lives in the form component for that reason, and the save bar
  gets it as a prop.
- `withForm` takes `formOptions` with default values, but the real ones are
  loaded. The shared options carry a blank profile, and `useAppForm` gets
  the loaded one.
- TanStack's field context can't tie a select's options to the field's
  value type, so `Select` takes strings.

On our side, `store.changes()` is a read, not a subscription, and the form
snapshot doesn't change on a second edit while the form is already dirty. The
save bar reads the count under `useField(form.root, ...)`, which re-runs on
every value change.

## Running

From the repo root:

```sh
bun run --cwd examples/compare test:e2e   # every spec, both libraries, Chromium
bun run --cwd examples/compare build      # every app into examples/compare/dist
```

The specs build the apps from the library's source and serve them on port
4890. Set `COMPARE_PORT` to use another. Playwright needs Chromium once:
`bunx playwright install chromium` in this folder.

## Sizes

```sh
bun run build && bun run size:compare           # measure and write sizes.json
bun run build && bun run size:compare --check   # fail when sizes.json is stale
```

Each app is built three times per library, for production and minified:

| Build | What is external |
| --- | --- |
| Total | nothing: React, react-dom, Zod, the form library and the app |
| Forms + app | React, react-dom and Zod |
| App only | React, react-dom, Zod, `@lunarhue/*` and `@tanstack/*` |

Our packages resolve to their built `dist`, as they would for an app that
installs them. Only JavaScript counts. `sizes.json` has the minified, gzip and
brotli bytes of every build, and the versions measured. CI runs the check, so
a change that moves a size has to commit the new numbers, and prints the table
in the job summary.
