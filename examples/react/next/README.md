# Next.js example

Three pages in a Next.js App Router app:

- `/` is the full "New order" form. The form itself lives in
  `@lunarhue/forms-example-react` (`examples/react/shared`), built to be
  shared by several apps, and this app is the shell around it.
- `/basic` is a small "Sign up" form in one file,
  `app/basic/page.tsx`. Read it top to bottom to see the whole API in a
  few components: the schema, `createForms` with two field components,
  `define`, a reusable address fieldset, a submit button that reads the
  form from context with `useFormContext(forms)`, and the page with
  `form.Field` and `form.Items`.
- `/bind` is the root README's example, running, in `app/bind/page.tsx`.
  `createForms` installs `zod()` and `rebase()`, and the definition binds
  the form to a zustand store with `zustand()` from
  `@lunarhue/forms-bind/zustand`. The store's state shows beside the form,
  and a button changes the store from outside. Refresh loads a fresh copy
  and rebases the form onto it, keeping the fields you edited.

## Run it

From the repo root, build the library packages once, since the app loads
their `dist`:

```sh
bun install
bun run build
```

Then, from this directory:

```sh
bun run dev        # next dev on http://localhost:3000
bun run build      # production build
bun run start      # serve the production build
bun run typecheck
bun run e2e        # Playwright smoke tests against next dev
```

`bun run e2e` needs Chromium once: `bunx playwright install chromium`. Set
`E2E_PRODUCTION=1` to run the tests against `next build` and `next start`
instead. Next.js allows one `next dev` per app directory, so while `bun run
dev` is running, point the tests at it with
`E2E_BASE_URL=http://localhost:3000 bun run e2e`.

## What to look at

Start with `app/basic/page.tsx` if the library is new to you. The rest of
this list is about the full example.

- `app/page.tsx` is a server component. It loads the order with
  `loadOrder()` and passes it to `OrderPage` as `defaultValues`, so the HTML
  already has the values in the inputs. View the page source to check.
- `app/actions.ts` is the server action that saves the order. The form's
  `onSubmit` calls it with the inspector's "slow network" and "server
  rejects next save" settings, and puts a refused save's errors on the form.
- The pills next to each field count that component's commits. Type in the
  customer's name and only the name's pill moves. Change a quantity and the
  quantity, its line total and the amount due move, while the row does not.
- The inspector on the right shows the store as it changes. Its controls
  reset the form, fill it with invalid data, and toggle the fake server's
  behaviour.
- Untick and tick "Ship to the billing address" to see the shipping
  fieldset enabled and disabled. A `rules` entry on the order definition
  sets the flag from the value, on the server too.
- Every field keeps a line of space under it for its errors, even when it
  has none. Errors show when a field is blurred, and clicking submit blurs
  the field being edited, so an error line that pushed the button down
  would make that click miss.

## Config notes

- `next.config.ts` turns on the React Compiler and StrictMode, and lists the
  example packages in `transpilePackages`, since they ship TypeScript source.
- `tsconfig.json` keeps `moduleResolution: "nodenext"`. Turbopack reads it,
  and only then does it resolve the example packages' `./schema.js` imports
  to `schema.ts`. So the app's own imports use `.js` suffixes as well.
