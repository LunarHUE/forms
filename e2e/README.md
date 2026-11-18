# End-to-end suite

One Playwright suite that every adapter must pass. Each framework has a small
app that renders the same forms, server-renders them and hydrates them. The
same spec files run against every app, one Playwright project per framework.
A spec that passes on React and fails on Solid is a bug in an adapter or in
core.

The suite is private (`@lunarhue/forms-e2e`) and isn't part of the six root
checks.

## Running it

From the repo root:

```sh
bun run e2e                              # every framework
bun run e2e:changed                      # frameworks the changes since origin/main reach
bun run e2e:changed --base <ref>         # ... since another ref
bun run e2e:changed --framework solid    # only the frameworks named
bun run e2e:changed --dry-run            # print the choice and why, run nothing
bun run e2e -- --grep arrays             # anything after -- goes to Playwright
```

Playwright needs Chromium once: `bunx playwright install chromium` in `e2e`.

Every framework runs in Chromium. Set `E2E_BROWSER` to `firefox` or `webkit`
to run them all in that browser instead, after installing it the same way:

```sh
E2E_BROWSER=firefox bun run e2e
```

CI runs all three browsers, one job each: `e2e (chromium)`, `e2e (firefox)`
and `e2e (webkit)`. A pull request runs the frameworks its changes reach, and
only the Chromium job must pass to merge. A push to `main` and a weekly run
do every framework. The weekly run catches a new browser build that breaks
something when no code changed.

Each run builds the apps it needs once, in production mode, and starts one
server per app on its own port (4311 for React, 4312 for Solid). Playwright
stops them when the run ends. Specs run in parallel.

Run Playwright directly from `e2e` only with
`NODE_OPTIONS=--conditions=@lunarhue/source`, since the specs import the
contract and the contract imports the library from source. `run.ts` sets it.

## How `e2e:changed` picks

It lists the files changed against the base (committed, uncommitted and
untracked), then:

- Docs (`docs/`, Markdown anywhere, changesets, `LICENSE`, issue templates)
  count for nothing. Docs alone run nothing. CI uses the same rule to skip
  its checks on a docs-only change.
- A file outside every workspace package, such as root config or `bun.lock`,
  runs every framework.
- A file inside a package runs every framework whose app depends on that
  package, directly or through others. The graph comes from the workspace
  `package.json` files. Every app depends on this package, so a change to the
  specs, the contract or the server runs everything, and so does a change to
  core, schema or bind, which the contract uses.

It prints one line per framework saying why it runs or why it was skipped.
The decision is `changed/pick.ts`, a pure function with its own unit tests,
which run in the root `test`.

## Layout

- `contract/`: everything apps and specs share, with no framework in it. The
  scenario list, each scenario's schema, starting values, labels, plugins and
  expected server HTML (`contract/scenarios/*.ts`), the fake server, the
  state probe, the render counter and the list of frameworks with what each
  one is expected to do.
- `apps/react`, `apps/solid`: the thin apps. `src/parts.tsx` has the field
  components, the probe and the render counter. `src/pages/*.tsx` has one
  page per scenario. `src/entry-server.tsx` and `src/entry-client.tsx`
  render and hydrate.
- `server.ts`: the one server every app runs on. It imports the app's built
  server entry, wraps the markup in the same document and serves the client
  build.
- `vite.base.ts`: the Vite config both apps share.
- `specs/`: the Playwright specs. They find things through the contract only:
  roles, labels and test ids.
- `changed/` and `run.ts`: the changed-files command.

Every page has a state probe, `data-testid="probe"`, that holds the form
snapshot as JSON once the page is live: the value, every field's errors and
flags, the array keys, the submission, and what the fake server was asked.
Specs read it with `probe(page)`. Every field has a render counter,
`data-testid="renders-<field name>"`. React counts each render. Solid
components run once, so its counters stay at 1, and the contract's
`rerendersOnChange` says which a framework does.

## Adding a scenario

1. Add `contract/scenarios/<id>.ts`: start it with `scenario("<id>", title,
   serverView)`, then its labels, its `definition` (what `forms.define`
   takes) and anything its pages share. Add it to the list in
   `contract/scenarios.ts` and export it from `contract/index.ts`.
2. Add `src/pages/<id>.tsx` to each app and put it in that app's `pages` in
   `src/app.tsx`. Until every app has it, `typecheck` fails.
3. Add `specs/<id>.spec.ts`. The server spec already checks the new page's
   server HTML and hydration from its server view.

## Adding a framework

1. Write its app in `apps/<name>`: a workspace package that depends on
   `@lunarhue/forms-e2e` and the adapter, with a `build` script that writes
   `dist/client/assets/client.js` and `dist/server/entry-server.js` (see
   `vite.base.ts`). Its server entry exports `render` as `RenderPage` types
   it, and its client entry hydrates `#app`. It needs one page per scenario,
   and `typecheck` says which are missing.
2. Add one line to `frameworks` in `contract/frameworks.ts`: its name, a
   free port and whether its components run again on a change.

No spec changes. `e2e:changed` finds the new app through its
`package.json`.

## When a spec fails on one framework

Don't change a spec to hide it. Add it to that framework's `knownFailures` in
`contract/frameworks.ts`, keyed `<spec file> > <describe> > <title>`, with a
note on what differs. It then runs as an expected failure, and turns red once
the adapter is fixed, so the entry can go.
