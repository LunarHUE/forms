---
"@lunarhue/forms-core": minor
"@lunarhue/forms-react": minor
---

`define` in `/mini` takes a function of per-form options, as the main entry's does: `forms.define((options: { q: string }) => ({ defaultValues: { q: options.q } }))`. The function runs once per store. `createStore(options, instance?)` and `useForm(definition, options, settings?)` take the options first, and a plain config still takes none. `useForm` reads the options on the first render only. Mini's `define` type parameters are now `<V, S, O, R>`, so `O` sits where it does on the main entry.
