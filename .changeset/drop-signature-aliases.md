---
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

The adapters no longer export a type for each function's signature. Each one only named the type of a function you can already import, so use `typeof` on the function instead.

Removed from `@lunarhue/forms-react`: `CreateForms`, `UseForm`, `UseFormContext`, `UseDisabledErrors`, `UseField`, `UseFormState`, `UseItems`, `UseValidator`, `UseInputProps`, `UseFieldRef` and `ErrorId`. Write `typeof useForm` for `UseForm`, and the same for the others.

Removed from `@lunarhue/forms-solid`: `CreateForms`, `CreateForm`, `UseFormContext`, `CreateDisabledErrors`, `CreateField`, `CreateItems`, `CreateValidator`, `CreateInputProps` and `FieldRef`. Write `typeof createForm` for `CreateForm`, and the same for the others. `DefineFieldset` is gone too. Its type is now `SolidForms<P, E, F>["fieldset"]`.

To get at part of a signature, use `Parameters<typeof x>` or `ReturnType<typeof x>`, or the named type it is built from, such as `FormsOptions` for the options of `createForms`. For a function with overloads these utilities read the last overload only.

The doc comments moved from the removed types to the functions, so your editor shows the same text on hover.
