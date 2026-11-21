// Binds Solid 2 (solid-js 2 with @solidjs/web).
export * from "@lunarhue/forms-core";
// Plugin types too, so declarations that tsc writes for a consumer name them
// through this package. Strict installs (pnpm, Bun isolated) hide core from it.
export type * from "@lunarhue/forms-core/plugins";
export { createDisabledErrors, createForm, createForms, createInvalidFields, useFormContext } from "./forms.js";
export { defineField } from "./field-type.js";
export type {
  AnyForm,
  BoundChoiceComponent,
  BoundField,
  BoundFieldComponent,
  FieldComponents,
  Fieldset,
  NamedFieldset,
  FieldType,
  FocusOnInvalid,
  FocusTarget,
  FormComponent,
  FormElementProps,
  FormMembers,
  FormOf,
  FormSettings,
  FormsOptions,
  HandleOf,
  NoFieldComponents,
  Scope,
  ScopeMembers,
  SolidForm,
  SolidFormDefinition,
  SolidForms,
  ValidateProp,
} from "./forms.js";
export { createField, createValidator } from "./field.js";
export { createItems, Items } from "./items.js";
export type { ItemsProps } from "./items.js";
export type {
  ExactFieldApi,
  FieldApi,
  FormState,
  HandleLike,
  SnapshotOf,
} from "./field.js";
export type { ArrayPath, FieldPath, PathMaxDepth, ValueAt } from "./path.js";
export { errorId, fieldRef } from "./input.js";
export { checkboxProps, inputProps, selectProps, textareaProps } from "./input-props.js";
export { checkboxGroupProps, radioProps } from "./choice-props.js";
export { numberPieces, numberProps, rangeProps } from "./number-props.js";
export type { NumberPieces } from "./number-props.js";
export { elementsOf, fieldOf } from "./lookup.js";
export type { FieldPieces, TextSource } from "./pieces.js";
export type {
  BaseInputProps,
  CheckboxGroupInputProps,
  CheckboxInputProps,
  DescribedByOption,
  EmptyOption,
  FieldObjectLike,
  NumberInputProps,
  RadioInputProps,
  RangeInputProps,
  SelectProps,
  TextareaProps,
  TextInputOptions,
  TextInputProps,
  TextInputType,
} from "./input.js";
