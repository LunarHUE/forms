# Examples

Every example app builds the same "New order" form, next to a dev inspector
that shows the store's state as it changes. React with Next.js is the only
framework so far.
They are workspace packages, so they install the library packages from this
repo with `workspace:*`.

## Layout

- `examples/shared/*` holds framework-free code that every app imports as
  TypeScript source. Nothing here is built or published.
  - `order` (`@lunarhue/forms-example-order`): the valibot schema, the option
    lists, the validators the schema can't express, a fake server, the
    server settings the inspector toggles, an invalid value for testing, and
    `styles.css`, the one stylesheet for the whole page.
  - `inspector` (`@lunarhue/forms-example-inspector`): the dev panel, written
    in plain DOM. `mountInspector(element, store, options)` renders it and
    returns the function that removes it.
- `examples/react/*` holds the React apps.
  - `shared` (`@lunarhue/forms-example-react`): the form, its field
    components, the render badges and the inspector wrapper, as TSX source.
    `OrderPage` takes the save function, the starting values and a header
    from each app.
  - `next` (`@lunarhue/forms-example-next`): the Next.js App Router app.

There are no Solid or Vue examples yet.

## Commands

The root `typecheck`, `lint` and `test` scripts cover every example that has
a `typecheck` script or a `vitest.config.ts`. `build`, `check:package` and
`size` only run for `packages/*`.
