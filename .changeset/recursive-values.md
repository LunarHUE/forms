---
"@lunarhue/forms-core": patch
---

`define` now accepts a value type that refers to itself, such as a tree node with a `children` array of tree nodes, or two types that refer to each other. Before, TypeScript rejected these with error TS2615.
