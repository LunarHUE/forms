// Binds Solid 2 (solid-js 2 with @solidjs/web).
export * from "@lunarhue/forms-core";
export { createForms } from "./forms.js";
export type { CreateForms, SolidFormDefinition, SolidFormsCore } from "./forms.js";
export { createField, createFormState, createItems, createValidator } from "./field.js";
export type {
  ArrayHandleLike,
  CreateField,
  CreateFormState,
  CreateItems,
  CreateValidator,
  FieldState,
  FormState,
  FormStateSource,
  HandleLike,
  SnapshotOf,
  ValidatorHandleLike,
} from "./field.js";
export { FormContext, useFormStore } from "./context.js";
export type { ContextStore, UseFormStore } from "./context.js";
export { Field, Items } from "./components.js";
export type { FieldComponent, FieldProps, ItemsComponent, ItemsProps } from "./components.js";
export { createInputProps, errorId, fieldRef } from "./input.js";
export type {
  CheckableProps,
  CheckboxGroupOptions,
  CheckboxOptions,
  ControlProps,
  CreateInputProps,
  FieldRef,
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
export { createDisabledErrors, createSubmit } from "./submit.js";
export type {
  CreateDisabledErrors,
  CreateSubmit,
  FormElementProps,
  InvalidSubmit,
  SubmitBinding,
  SubmitOptions,
} from "./submit.js";
