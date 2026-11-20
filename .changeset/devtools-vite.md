---
"@lunarhue/forms-devtools": minor
---

`@lunarhue/forms-devtools/vite` exports `formsDevtools()`, a Vite plugin that fills the Bundle tab. It measures what core, the adapter, each plugin and the devtools add to your minified production build, and the whole app's minified and gzip size. `vite build` writes the report next to the build. `vite dev` builds the app for production in the background, writing nothing, and serves the report from the dev server.
