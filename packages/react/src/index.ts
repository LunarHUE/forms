// Binds React to the form store in @lunarhue/forms-core.
export * from "@lunarhue/forms-core";
// Plugin types too, so declarations that tsc writes for a consumer name them
// through this package. Strict installs (pnpm, Bun isolated) hide core from it.
export type * from "@lunarhue/forms-core/plugins";
export { createForms, useDisabledErrors, useForm, useFormContext } from "./forms.js";
export { defineField } from "./field-type.js";
export type {
  FocusOnInvalid,
  FocusTarget,
  FormComponent,
  FormComponentProps,
  FormElementProps,
  FormInstance,
  FormMembers,
  FormOf,
  Forms,
  FormsOptions,
  FormStateComponent,
  FormStateProps,
  ReactFormDefinition,
  UnknownForm,
  UseFormOptions,
} from "./forms.js";
export type {
  BoundChoiceComponent,
  BoundField,
  BoundFieldComponent,
  BoundItems,
  FieldApi,
  FieldApiOf,
  FieldComponentMap,
  FieldType,
  FieldValueOf,
  ExactFieldApi,
  Fieldset,
  HandleOf,
  NoFields,
  // Stays public: declarations inferred from a bound field component, as
  // `typeof form.TextField`, name it as `OwnPropsOf<typeof TextField>`.
  OwnPropsOf,
  Scope,
  ScopeMembers,
  ValidateProp,
} from "./scope.js";
export type { ArrayPath, FieldPath, PathMaxDepth, ValueAt } from "./path.js";
export { useField, useFormState, useItems, useValidator } from "./field.js";
export type {
  HandleLike,
  IsEqual,
  SnapshotOf,
} from "./field.js";
export { errorId, inputProps, useFieldRef, useInputProps } from "./input.js";
export type { FieldPieces, TextSource } from "./pieces.js";
export type {
  BaseInputProps,
  CheckboxGroupInputProps,
  CheckboxGroupOptions,
  CheckboxInputOptions,
  CheckboxInputProps,
  FieldObjectLike,
  FieldRef,
  NumberInputOptions,
  NumberInputProps,
  RadioInputOptions,
  RadioInputProps,
  SelectOptions,
  SelectProps,
  TextareaOptions,
  TextareaProps,
  TextInputOptions,
  TextInputProps,
  TextInputType,
} from "./input.js";
