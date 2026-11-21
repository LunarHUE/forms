---
"@lunarhue/forms-devtools": minor
---

The devtools panel. It docks in a corner of the page and lists the forms on the page by their store `id`. Pick mode outlines each form so you can click the one to inspect. The Fields tab shows the value tree with each field's flags, and a selected field's value against its baseline, display text, errors by source, attached plugins and last write. The panel is a chunk of its own with Preact bundled in, and renders in a shadow root. It reads the forms on each animation frame while it's open and never subscribes to a store.
