---
"@lunarhue/forms-solid": patch
---

Moving a row in `Items` keeps focus on the row's input. Solid 1, and Solid 2 in browsers without `moveBefore` such as Safari, take a moved row out of the document for a moment, which blurred the input. `Items` now focuses it again once the move is done.
