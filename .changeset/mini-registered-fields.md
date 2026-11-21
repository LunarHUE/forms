---
"@lunarhue/forms-react": minor
---

`createForms({ fields })` in `@lunarhue/forms-react/mini` registers plain field components, as the main entry does: `<form.TextField name="email" label="Email" />` checks the name and value type and passes the component's own props through. A component written against mini's `FieldApi` works unchanged on the main entry. `defineField` entries still need the main entry. It adds about 60 B brotli to `/mini`.
