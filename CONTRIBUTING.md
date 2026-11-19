# Contributing

Thanks for looking. This is a small project with a few firm habits, and they
are all written down here. What CI enforces is marked as such.

## Setup

You need [Bun](https://bun.sh) at the version in `package.json`'s
`packageManager` field and Node at the version in `.node-version`. With Nix,
`nix develop` gives you both.

```sh
bun install
bunx playwright install chromium   # once, for the browser suite
```

Packages read each other from source, so you never build before you test.

## The checks

Seven checks run on every pull request. Run them from the repo root before you
push.

```sh
bun run typecheck
bun run lint
bun run test
bun run build
bun run check:package
bun run size
bun run size:forms
```

`typecheck` also writes declarations for the fixtures in `scripts/fixtures`,
which export forms, definitions and fieldsets with inferred types the way an
app does. If an adapter stops exporting a type those inferred types name, it
fails with TS2883 ("cannot be named").

The browser suite is separate. It runs the same specs against every adapter.

```sh
bun run e2e:changed   # the adapters your change can reach
bun run e2e           # every adapter
```

CI runs `e2e:changed` on a pull request and the full suite on `main`, in
Chromium, Firefox and WebKit, one job per browser. Only `e2e (chromium)` must
pass to merge. A red Firefox or WebKit job still deserves a look before you
ask for review. The full suite also runs in all three once a week.
[e2e/README.md](e2e/README.md) explains how the suite is laid out and how it
picks.

## How work lands

1. **Open an issue first.** Say what is wrong or missing and what done looks
   like. For a bug, a failing test or a small reproduction is the best
   description there is. Typos and one-line fixes can skip this.
2. **One pull request per issue**, against `main`, with `Closes #<issue>` in
   the description.
3. **Small commits**, one logical change each, with a short imperative subject:
   "Keep the caret when a mask reformats", not "fixes" or "Updated mask.ts".
4. **Add a changeset** if your change reaches a published package. See below.

A pull request merges when the checks and the Chromium browser suite pass and a
maintainer has read it.

## Changesets

Every pull request that changes the source of a published package needs a
changeset. CI fails without one.

```sh
bun run changeset
```

Pick the packages you changed and write one or two sentences for the people
who use the library. Say what changed for them, not what you did to the code.

- **patch**: a fix, or anything that changes no one's code.
- **minor**: a breaking change or a new feature. Until 1.0 a minor may break.

The published packages share one version, so the bump you pick applies to all
of them at release.

A change no user can see, such as a refactor, a test or a comment, needs no
changeset. Ask a maintainer to add the `no-changeset` label and the check
passes.

## Releases

Maintainers do these, by hand for now.

1. Each merge to `main` updates a "Version Packages" pull request. It collects
   the pending changesets, bumps the versions and writes the changelogs. Merge
   it when you want a release. It runs the six checks and skips the browser
   suite, which already ran on the same source on `main`.
2. Wait for CI on `main`, which runs the browser suite in every browser. Then,
   on an up-to-date `main`, log in to npm and publish:

   ```sh
   npm login
   bun run release
   git push --follow-tags
   ```

`bun run release` builds, packs each package with Bun and publishes the
tarballs in dependency order. It skips versions already on npm, so it is safe
to run again after a failure. Never run `npm publish` inside a package
folder. That ships `workspace:` versions nobody can install.

## Size

Each entry point has a limit in its package's `size-limit` list, and
`bun run size` fails when an entry goes over.

- A feature should cost nothing for people who don't use it. Put it in a
  plugin or its own entry point before you put it in core.
- A limit is a guard, not a budget to fill. If your change needs more room,
  raise the limit in the same pull request and say by how much and why.
- Readable code wins over a few bytes. Don't golf core to stay under.
- The "everything on" lines have no limit. They are printed so the total
  stays in view.

`bun run size:forms` measures whole forms instead: the fixtures in
`scripts/fixtures`, built from source with Vite in production and in
development. It prints a table and has no limits. Paste the table in a pull
request that changes what a form ships.

## Code style

oxlint enforces most of it. The rest:

- TypeScript in strict mode. No `any`, and no cast where a type guard works.
- Write code that reads at a glance. `while (true)`, not `for (;;)`.
- Component props are a named interface, destructured in the signature. In
  Solid, don't destructure props, since that drops reactivity.
- No higher-order components. Share adapter code as plain functions and plain
  components.
- Comments say why, not what.
- A message the user can hit goes through `problem()` and gets an entry in
  [apps/docs/src/content/errors.mdx](apps/docs/src/content/errors.mdx).

## Tests

- Unit tests sit next to the file they test as `*.test.ts`. Type tests are
  `*.test-d.ts`.
- A bug fix comes with a test that fails without the fix.
- Behaviour a user can see in a browser belongs in the `e2e` suite, written
  once and run against every adapter. If a spec passes on one adapter and
  fails on another, that is a bug, not a difference to document.

## Plugins

There are three tiers, and which one a plugin belongs to decides where it
lives.

- **First class**: no dependencies, lives in core under
  `packages/core/src/plugins` with its own entry point.
- **Third party**: needs a dependency, so it gets its own package in this
  repo. The schema plugins are these.
- **Community**: yours, in your own package, named `forms-plugin-<name>`.

A plugin depends on core and never on an adapter.
[Writing a plugin](https://forms.lunarhue.dev/react/plugins/writing-a-plugin)
has the rules.

## Adapters

An adapter is done when it passes the `e2e` suite. Add an app under
`e2e/apps/<framework>`, add the framework to `e2e/contract/frameworks.ts`,
and make every spec pass. Open an issue before you start one, since it is a
lot of work to throw away.

## Security

Don't open a public issue for a vulnerability. [SECURITY.md](SECURITY.md)
says how to report one.
