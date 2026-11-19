// Binds Solid 2 (solid-js 2 with @solidjs/web).
export * from "@lunarhue/forms-core";
// Plugin types too, so declarations that tsc writes for a consumer name them
// through this package. Strict installs (pnpm, Bun isolated) hide core from it.
export type * from "@lunarhue/forms-core/plugins";
export { createDisabledErrors, createForm, createForms, useFormContext } from "./forms.js";
export { defineField } from "./field-type.js";
export type {
  AnyForm,
  BoundChoiceComponent,
  BoundField,
  BoundFieldComponent,
  BoundItems,
  FieldComponents,
  Fieldset,
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
export { createField, createItems, createValidator } from "./field.js";
export type {
  ExactFieldApi,
  FieldApi,
  FormState,
  HandleLike,
  SnapshotOf,
} from "./field.js";
export type { ArrayPath, FieldPath, PathMaxDepth, ValueAt } from "./path.js";
export { createInputProps, errorId, fieldRef, inputProps } from "./input.js";
export type { FieldPieces, TextSource } from "./pieces.js";
export type {
  CheckableProps,
  CheckboxGroupOptions,
  CheckboxOptions,
  ControlProps,
  FieldObjectLike,
  InputOptions,
  NumberInputOptions,
  NumberInputProps,
  NumberInputType,
  RadioOptions,
  SelectOptions,
  SelectProps,
  TextareaOptions,
  TextareaProps,
  TextInputOptions,
  TextInputProps,
  TextInputType,
} from "./input.js";
