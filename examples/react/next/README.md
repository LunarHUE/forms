# Next.js example

The "New order" form in a Next.js App Router app. The form itself lives in
`@lunarhue/forms-example-react` (`examples/react/shared`); this app is the
shell around it.

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

- `app/page.tsx` is a server component. It loads the order with
  `loadOrder()` and passes it to `OrderPage` as `defaultValues`, so the HTML
  already has the values in the inputs. View the page source to check.
- `app/actions.ts` is the server action that saves the order. The form's
  `onSubmit` calls it with the inspector's "slow network" and "server
  rejects next save" settings, and puts a refused save's errors on the form.
- The pills next to each field count that component's commits. Type in the
  customer's name and only the name's pill moves. Change a quantity and the
  quantity, its line total and the amount due move, while the row does not.
  Every field pill starts at 2, not 1: hydration renders each field
  component twice, which is an adapter bug, not something this page does.
- The inspector on the right shows the store as it changes. Its controls
  reset the form, fill it with invalid data, and toggle the fake server's
  behaviour.
- Untick and tick "Ship to the billing address" to see the shipping
  fieldset enabled and disabled through the handle's `setDisabled`.

## Config notes

- `next.config.ts` turns on the React Compiler and StrictMode, and lists the
  example packages in `transpilePackages`, since they ship TypeScript source.
- `tsconfig.json` keeps `moduleResolution: "nodenext"`. Turbopack reads it,
  and only then does it resolve the example packages' `./schema.js` imports
  to `schema.ts`. So the app's own imports use `.js` suffixes as well.
