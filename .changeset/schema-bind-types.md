---
"@lunarhue/forms-schema": patch
"@lunarhue/forms-bind": patch
---

The schema and bind declarations bundle core's types, as the adapters' do. A project that installs an adapter with `valibot()`, `zod()`, `zustand()` or `signal()` under a strict install (pnpm, Bun isolated) no longer gets TS2307 for `@lunarhue/forms-core` in the declarations it emits. Each entry also exports the type its plugin returns, `Plugin` or `BindPlugin`. Both packages' declarations grow by about 73 kB.
