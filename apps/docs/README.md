# Forms docs

The docs site for LunarHUE Forms, built with Astro. Run `bun run dev` here, or `bun run build && bun run preview`.

## Two renderers

Demos render in their own framework. React (`@astrojs/react`) handles `src/components`, `src/devtools`, `src/layouts` and `src/demos/react`. Solid 2 handles `src/demos/solid`. Both compile `.tsx`, so each renderer gets an `include` list in `astro.config.ts`, and the Solid demos have their own `tsconfig.json` with Solid's JSX settings.

`@astrojs/solid-js` 7.x only supports Solid 1, and 8.x isn't on npm yet (checked 2026-11-18). Until it is, `integrations/solid/` holds a small Solid 2 renderer copied from Xenon's docs. Its server `check()` only claims hydrated components whose URL contains `/demos/solid/`. Astro sets `componentUrl` only when a component has a `client:` directive, so a Solid demo without one won't render. Every demo is an island anyway.

To switch to the official integration once 8.x ships:

1. `bun add @astrojs/solid-js@8` in this app.
2. In `astro.config.ts`, import `solid` from `@astrojs/solid-js` instead of `./integrations/solid` and keep `include: ["**/src/demos/solid/**"]`.
3. Drop `@solidjs/vite-plugin` from `devDependencies` if the integration brings its own, and delete `integrations/solid/`.

## Resetting a demo

A demo resets by mounting again from its server HTML. The wrapper renders its slot once with `Astro.slots.render`, writes it into the stage, and writes a copy without `<script>` tags into a `<template>`. Reset clones the template into the stage and then dispatches `astro:unmount` on the old islands. Astro fires that event only after a view-transition swap, so the wrapper has to send it itself. The new `<astro-island>` connects and hydrates like the first one did.

This works for both React and Solid 2, in `astro build` + `astro preview` and in `astro dev`. Solid hydrates the clone even though it reuses the old render id, also after a second reset. The `client:only` fallback wasn't needed. The prototype is `src/pages/proof/_ResetStage.astro` in commit 6cc2abe, deleted after it.

## Adding a demo

1. Write the demo for each framework the page lists in `frameworks`: `src/demos/react/<page>/<demo>/<demo>.tsx` and `src/demos/solid/<page>/<demo>/<demo>.tsx`, each with a default export. Other files in the folder (`PhoneField.tsx`) show up as tabs in the Code view; the entry file comes first.
2. Use bare `<form>`, `<label>`, `<input>` and `<button>`. `src/styles/demo.css` styles them.
3. In the MDX page, write `<Demo name="<page>/<demo>" />`. Add `form="..."` if the devtools tag should show a name other than the folder's.

The `demos` MDX plugin (`src/lib/mdx/demos.ts`) turns that into imports and one `client:visible` slot per framework. If a framework the page lists has no demo folder, the build fails with the file and line of the `<Demo>`.

Astro renders every slot of an Astro component up front, used or not, so the other framework's demo also renders on the server. If it is the first island on the page it takes Astro's island loader script with it. `Demo.astro` copies that script out of the unused slots. The same thing happens to islands inside an `<Only>` for another framework.

## Tests

`bun run test:e2e` builds the site, serves it with `astro preview` on port 4560 and runs the smoke tests in `tests/` in Chromium. `DOCS_PORT` picks another port; `DOCS_BUILT=1` skips the build and serves the `dist/` already there. The tests find things by role, data attribute and URL, not by copy, so rewording a page shouldn't break them. The `docs` job in `.github/workflows/ci.yml` runs the typecheck, the build and these tests.

## Deploy

`.github/workflows/docs-deploy.yml` uploads `dist/` to the Cloudflare Pages project `lunarhue-forms-docs` with `wrangler pages deploy`. A push to main that touches `apps/docs`, `packages` or `bun.lock` deploys to production (branch `main`), and so does running the workflow by hand. A pull request from a branch of this repo deploys a preview at `<branch>.lunarhue-forms-docs.pages.dev`. Pull requests from forks get no preview, since they can't read the secrets.

It needs two repository secrets:

- `CLOUDFLARE_API_TOKEN`: an API token with the Account > Cloudflare Pages > Edit permission.
- `CLOUDFLARE_ACCOUNT_ID`: the account that owns the project.

Create the project once as a Direct Upload project, with `main` as its production branch: `bunx wrangler pages project create lunarhue-forms-docs --production-branch=main`. Then point `forms.lunarhue.dev` at it under the project's Custom domains.

`build.format: "file"` writes `errors.html`, `react/install.html` and so on. Pages serves `errors.html` at `/errors` without a redirect and redirects `/errors.html` to `/errors`, so the extensionless URLs the site links to need no `_redirects` or `_headers` file. `404.html` at the root is Pages' not-found page.
