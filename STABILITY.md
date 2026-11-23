# Stability & Versioning Policy

`@lunarhue/forms` follows [Semantic Versioning 2.0.0](https://semver.org/) once `1.0.0` is released. Until `1.0.0`, breaking changes may land in minor releases (`0.x.0`) and are called out in changesets and release notes.

## Package Versioning

- **Core lockstep group (`@lunarhue/forms-core`, `@lunarhue/forms-react`, `@lunarhue/forms-solid`, and `@lunarhue/forms-vue` when published):** share one version so core and framework adapters always match.
- **Satellite packages (`@lunarhue/forms-schema`, `@lunarhue/forms-bind`, `@lunarhue/forms-devtools`):** versioned independently (starting in `0.3.0`) with a `^1.0.0` peer dependency on `@lunarhue/forms-core` at `1.0.0`. A major bump in an external peer (e.g. Zustand or Zod) will not force a core major release.

## What Is Covered by Semver (Public API)

A symbol is part of the public API if and only if:

1. It is exported from a documented package entry point in `package.json` `exports`, **and**
2. It is documented in the [API reference](https://forms.lunarhue.dev/react/reference/api) (or its package README) without an `@experimental` or `@internal` marker.

### Explicitly Excluded from Semver

- **Tilde-prefixed (`~`) properties** (e.g. `~host`, `~parts`, `~dirty`, `~arrays`) and anything documented as `Internal`.
- **Adapter-internal entry points** (`@lunarhue/forms-core/adapter`), intended for official framework adapters.
- **Experimental subpaths and packages:**
  - `@lunarhue/forms-core/mini` and `@lunarhue/forms-react/mini` remain `@experimental` through `1.0.0` until portable parts and shared cells stabilize.
  - Future `/unstable` subpaths or `0.x` experimental packages (such as `@lunarhue/forms-dom`) may change in minor releases until graduated.

## Open-Ended Unions & Extensibility

To allow additive features in minor releases without breaking user or plugin code, the following unions are **open-ended** and may gain new members in minor releases:

- `WriteCause` and `WriteRecord`
- `Submission["status"]` (and optional metadata fields such as `reason`)
- `ValidateTiming` (e.g. future object forms alongside string timings)
- `SchemaAdapter` optional capabilities (e.g. `constraints?`)

Plugins and consumers switching over these unions should include a `default:` branch.

## Type-Level Semver

We treat intentional removals or renames of public exported types and generic parameters as breaking changes. New generic parameters on public types always receive defaults. Stricter inference or bug fixes to previously unsound types may land in minor releases.

## Framework Support Matrix

At `1.0.0`, the supported matrix is tested in CI on every release:

- **React:** 18+ (default entry); React 16.8 / 17 via `@lunarhue/react-legacy` (best-effort through `1.x`).
- **Solid:** Solid 2 (default entry); Solid 1.8+ via `@lunarhue/forms-solid/v1`.
- **TypeScript:** 5.x+ (strict mode).
