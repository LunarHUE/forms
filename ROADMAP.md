# Roadmap to `1.0.0`

`@lunarhue/forms` is currently at `0.2.0`. Rather than rushing straight to `1.0.0`, we are taking a staged path that settles breaking API decisions early, proves the plugin API with real first-party plugins, validates edge-case contracts, and soaks a release candidate before freezing `1.0.0`.

See [STABILITY.md](STABILITY.md) for the versioning, public API, and semver policy that `1.0.0` establishes.

---

## `0.3.0` — API Cleanup, Adapter Boundary & Credibility

Settle the remaining breaking API changes in one release and close the biggest adoption/evaluation gaps.

### Core & Packaging
- **Adapter boundary ([#305](https://github.com/LunarHUE/forms/issues/305)):** Move internal core adapter helpers (`displayOf`, `tracking`, `attach`, `encodeSegment`, `trackedField`) into `@lunarhue/forms-core/adapter` and replace blanket `export *` in adapters with explicit public re-exports.
- **Submit model cleanup ([#306](https://github.com/LunarHUE/forms/issues/306)):** Keep `intent` on all terminal `Submission` statuses and `onSubmitted`, add quiet/non-counting submit for autosave, add an `invalid` reason discriminator, make `formProps` compatible with React 19 `<form action={fn}>` / `useActionState`, and expose a `FormDefinition` hook for server parsing.
- **Type & contract cleanup ([#307](https://github.com/LunarHUE/forms/issues/307)):** Freeze the error invariant ("everything in `errors` blocks"), add an extensible leaf registry for non-plain class instances (`Temporal`, `Decimal`, `dayjs`), decide tuple support, document open-ended unions (`WriteCause`, `WriteRecord`, `Submission["status"]`, `ValidateTiming`), clean up unprefixed internal keys on `NamedPart`, and add `describedBy` parity in React.
- **Plain string errors ([#263](https://github.com/LunarHUE/forms/issues/263)):** Accept plain strings alongside `FormError` consistently across validators and `setErrors` for the default error type.
- **Independent satellite versioning ([#308](https://github.com/LunarHUE/forms/issues/308)):** Keep `core`, `react`, and `solid` in lockstep; split `schema`, `bind`, and `devtools` out of the `fixed` changesets group.

### Ecosystem & Evaluation
- **React Hook Form comparisons ([#309](https://github.com/LunarHUE/forms/issues/309)):** Add `rhf` to `examples/compare` across `login`, `signup`, `profile`, and `backoffice`, update `sizes.json`, and publish fair side-by-side comparison docs.
- **Lower the cost of trying it ([#310](https://github.com/LunarHUE/forms/issues/310)):** Publish a GitHub-hosted **shadcn/ui `Field` registry** (`registry.json`), interactive **StackBlitz templates**, and `llms.txt` / `llms-full.txt` on `forms.lunarhue.dev`.

---

## `0.4.0` — Dogfood the Plugin API, Server/SSR & Solid 2

Stress-test the public plugin authoring API by shipping real first-party plugins built strictly on public hooks, and land the SSR/schema story.

- **First-party plugins on the public API:**
  - Validation warnings channel ([#134](https://github.com/LunarHUE/forms/issues/134))
  - Unsaved-changes guard ([#135](https://github.com/LunarHUE/forms/issues/135))
  - Autosave ([#137](https://github.com/LunarHUE/forms/issues/137))
- **Server & Standard Schema:**
  - Server `parse(def, FormData | json)` from the same definition ([#136](https://github.com/LunarHUE/forms/issues/136)), with FormData DoS limits.
  - HTML input constraints via Standard JSON Schema (`~standard.jsonSchema`) ([#138](https://github.com/LunarHUE/forms/issues/138)).
  - Opt-in `hydrate: "adopt"` to preserve pre-hydration input ([#302](https://github.com/LunarHUE/forms/issues/302)).
- **Solid 2 ecosystem guide ([#311](https://github.com/LunarHUE/forms/issues/311)):** Kobalte binding recipes and an end-to-end Solid 2 Start-mode (`action`, `createOptimistic`, `"use server"`) example.

---

## `0.5.0` — API Freeze Candidate & Migration Tooling

No new breaking changes except fixes for API shortfalls uncovered by `0.4.0`.

- **Edge-case freeze audit ([#313](https://github.com/LunarHUE/forms/issues/313)):**
  - Test and document hidden/disabled/unmounted field semantics, discriminated unions (`branch`), optional arrays (`undefined`/`null`), and `File`/`Date` behavior.
  - Add a React Compiler e2e run.
  - Run a throwaway **Vue adapter spike** against `@lunarhue/forms-core/adapter` to validate the core adapter contract before freezing.
  - Add docs recipes for Base UI, React Aria Components, ArkType, and Effect Schema.
- **Migration guides & agent migration skill ([#312](https://github.com/LunarHUE/forms/issues/312)):**
  - Migration guides from React Hook Form, TanStack Form, and Formik.
  - An installable **agent migration skill (`SKILL.md`)** covering RHF, TanStack Form, Formik, and `/mini` → full migrations (in place of a brittle AST codemod).

---

## `1.0.0-rc.N` → `1.0.0` — Soak & Stable Release

Tracked in [#314](https://github.com/LunarHUE/forms/issues/314):

- Publish `1.0.0-rc.1` via Changesets `pre` mode (`rc` dist-tag).
- Fixes only during the soak period; hold bundle budgets and the full React (16.8–19) and Solid (1.8–2) e2e matrix steady.
- Cut `1.0.0` once an RC soaks with no API changes, then publish design-decision write-ups and submit ecosystem listings (Standard Schema, awesome-react, awesome-solid).

---

## Experimental & Post-`1.0` (`1.x`)

Explicitly outside the `1.0.0` freeze so they can iterate cleanly without delaying stability:

- **`/mini` graduation:** Portable parts ([#258](https://github.com/LunarHUE/forms/issues/258)) and shared cells / smaller bare forms ([#259](https://github.com/LunarHUE/forms/issues/259)) — `/mini` remains `@experimental` until type assignability to full is verified.
- **Native uncontrolled DOM mode:** `@lunarhue/forms-dom` ([#301](https://github.com/LunarHUE/forms/issues/301)), incubated as a separate `0.x` package.
- **Build-time internal property mangling:** ([#188](https://github.com/LunarHUE/forms/issues/188)), unblocked once `#305` lands.
- **Vue adapter:** `@lunarhue/forms-vue` (currently a private stub).
- **Additive core/plugin features:** `watchFields` dependency option, `steps()` wizard plugin (if recipe usage warrants it), and additional input helpers (`fileProps`, multi-select).
