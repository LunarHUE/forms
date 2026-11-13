# forms

A form library that doesn't depend on any UI framework. The core holds the form
logic, and small adapters connect it to each framework or schema library.

| Package                  | What it is                                                |
| ------------------------ | --------------------------------------------------------- |
| `@lunarhue/forms-core`   | Framework-independent core                                |
| `@lunarhue/forms-react`  | React adapter (React 16.8 and later)                      |
| `@lunarhue/forms-solid`  | Solid adapter: Solid 2 at `.`, Solid 1 at `./v1`          |
| `@lunarhue/forms-vue`    | Vue 3 adapter                                             |
| `@lunarhue/forms-schema` | Schema adapters: Valibot at `./valibot`, Zod 4 at `./zod` |

The repo is in early setup. The packages build and publish-check, but none has a
real API yet and nothing is published.

## Scripts

Run these from the repo root with `bun run <name>`. Each one covers every package.

- `typecheck`: `tsc` over the tooling config files and each package. Packages read
  each other from source, so no build is needed first.
- `lint`: oxlint with type-aware rules, plus the React Compiler rules for
  `packages/react`. Warnings fail it.
- `test`: vitest, runtime tests and `*.test-d.ts` type tests.
- `build`: ESM in `dist/esm` and CJS in `dist/cjs` with tsdown, declarations
  with `tsc`. Packages build in dependency order.
- `check:package`: publint and arethetypeswrong on the packed package. Needs a build.
- `size`: size-limit on each entry point. Needs a build.

## Working on it

In a LunarHUE workspace this repo is checked out at `~/repos/forms` and runs
in its own pod.

- **Shell in the pod:** `ssh forms.<workspace>.repos` from your machine, or
  `ws attach forms` in the workspace.
- **Long-running commands** (dev servers, watchers):
  `ws run forms --name dev --wait-port <port> -- <command>`, then
  `ws ps`, `ws logs forms dev` and `ws stop forms dev`.
- **Dev environment:** `flake.nix` defines it. The pod enters its default
  devShell for every command. Add tools to `packages` there and commit
  `flake.lock`.
- **One-off commands from the parent:**
  `ws-route forms <dir> -- <command>` runs a command in the pod at
  `/workspace/<dir>` (`.` for the root), with the dev environment loaded.
- **Outside Coder:** `.devcontainer/devcontainer.json` opens the repo in the
  same image the pod uses. Run `docker login ghcr.io` first; the image is
  private.
