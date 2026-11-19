---
"@lunarhue/forms-react": minor
"@lunarhue/forms-solid": minor
---

The adapters stop exporting the types they only use to build other types. None of them shows up in a declaration TypeScript infers for your code, so a `.d.ts` you emit doesn't change. If you imported one by name, use the public type it feeds instead, such as `Scope`, `FieldApi` or the input props types, or copy the definition into your code.

Removed from `@lunarhue/forms-react`: `AcceptedHandle`, `AcceptedValues`, `ArrayHandleLike`, `BoundFieldComponents`, `CheckedFields`, `ChoiceFieldOf`, `EmptyOption`, `FieldByHandle`, `FieldByName`, `FieldComponentType`, `FieldPropOf`, `FormStateSource`, `InputHandleLike`, `InputOptionsFor`, `InputPropsFor`, `ItemsByHandle`, `ItemsByName`, `NameFitting`, `NameFittingChoice`, `NoOptionsArgs`, `ObjectHandleLike`, `PropsOf`, `ReservedName`, `ReservedProp`, `UseFormArgs`, `ValidatorHandleLike`.

Removed from `@lunarhue/forms-solid`: `AnyComponent`, `ArrayHandleLike`, `BoundFieldComponents`, `CheckedFields`, `ChoiceFieldOf`, `ChoicePath`, `ComponentHandle`, `CreateFormArgs`, `FieldCommands`, `FieldErrorOf`, `FieldTypes`, `FieldValueOf`, `FitPath`, `FitsComponent`, `IsBoolean`, `IsChoice`, `IsNumber`, `IsOption`, `IsOptionList`, `IsText`, `OwnProps`, `PropsOf`, `ReservedName`, `ReservedProp`, `ValidatorHandleLike`.

React keeps `OwnPropsOf`, because the inferred type of a bound field component names it.
