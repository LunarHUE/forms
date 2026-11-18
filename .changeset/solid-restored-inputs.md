---
"@lunarhue/forms-solid": patch
---

An input now shows the form's value after hydration even when the browser filled it back in first. Firefox restores typed text on a reload, and on Solid 2.0.0 the input kept that text while the form held something else.
