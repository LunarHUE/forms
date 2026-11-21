# @lunarhue/forms

Type-safe forms for React and Solid built on one small, framework-agnostic core (with Vue planned).

Values, validation, errors, and submission live in the core. Everything else (dynamic arrays, dirty tracking, undo history, persistence, rebase, conditional rules, schema defaults, and devtools) ships as opt-in plugins so your bundle only pays for what you use.

## Documentation

Read the full guides, live interactive demos, and API reference at **[forms.lunarhue.dev](https://forms.lunarhue.dev)**:

- [Introduction](https://forms.lunarhue.dev/react/introduction) and [Install](https://forms.lunarhue.dev/react/install)
- [Your first form](https://forms.lunarhue.dev/react/basics/first-form) ([Solid](https://forms.lunarhue.dev/solid/basics/first-form))
- [Plugins](https://forms.lunarhue.dev/react/plugins/using-plugins) and [Writing plugins](https://forms.lunarhue.dev/react/writing-plugins/first-plugin)
- [API reference](https://forms.lunarhue.dev/react/reference/api) and [Error codes](https://forms.lunarhue.dev/errors)

## Quick install

```sh
npm install @lunarhue/forms-react    # React 18+, or 16.8/17 with @lunarhue/react-legacy (plus /mini)
npm install @lunarhue/forms-solid    # Solid 2, or Solid 1.8+ from /v1
```

Optional packages:

```sh
npm install @lunarhue/forms-schema zod  # or valibot (automatic schema defaults)
npm install @lunarhue/forms-bind        # Zustand 5 or Solid 2 signal bindings
npm install @lunarhue/forms-devtools    # Live on-page form inspector plugin
```

## Packages

| Package | Description |
| --- | --- |
| `@lunarhue/forms-core` | Framework-agnostic store, validation, first-class plugins (`/plugins`), text masks (`/text`), and `/mini` |
| `@lunarhue/forms-react` | React adapter (React 18+ default, 16.8/17 via `@lunarhue/react-legacy`, experimental `/mini` entry) |
| `@lunarhue/forms-solid` | Solid adapter (Solid 2 default, Solid 1.8+ via `/v1`) |
| `@lunarhue/forms-schema` | Schema default adapters (`/zod`, `/valibot`) |
| `@lunarhue/forms-bind` | External store bindings (`/zustand`, `/solid`) |
| `@lunarhue/forms-devtools` | On-page devtools panel built as a core plugin |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, pull request workflow, changesets, and bundle-size checks. Report security issues through [SECURITY.md](SECURITY.md).

### Repo scripts

Run from the repository root with `bun run <script>`:

- `typecheck`: runs `tsc` across all packages, apps, examples, and e2e suites (packages resolve from source, no build needed first).
- `lint`: runs `oxlint` with type-aware rules and React Compiler rules for `packages/react`.
- `test`: runs Vitest runtime tests and `*.test-d.ts` type tests.
- `build`: builds ESM (`dist/esm`), CJS (`dist/cjs`), and `.d.ts` bundles in dependency order.
- `check:package`: runs `publint` and `arethetypeswrong` on packed packages (requires `build`).
- `size`, `size:forms`, `size:compare`: checks entry-point and comparison bundle budgets (requires `build`).
- `e2e`: runs the Playwright suite in [`e2e`](e2e/README.md) across supported React and Solid majors.
- `e2e:changed`: runs only the e2e majors affected by changes since `origin/main` (`--base <ref>` overrides the base).
