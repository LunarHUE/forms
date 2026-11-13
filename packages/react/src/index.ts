// Binds React to the form store in @lunarhue/forms-core. The exports below are
// the contract only: every runtime export is a stub that throws until it is implemented.
export * from "@lunarhue/forms-core";
export { createForms, useDisabledErrors } from "./forms.js";
export type {
  AnyFormInstance,
  CreateForms,
  FocusOnInvalid,
  FocusTarget,
  FormElementProps,
  FormInstance,
  Forms,
  FormsOptions,
  ReactFormDefinition,
  UseDisabledErrors,
  UseFormArgs,
  UseFormOptions,
} from "./forms.js";
export { useField, useFormState, useItems, useValidator } from "./field.js";
export type {
  ArrayHandleLike,
  FormStateSource,
  HandleLike,
  IsEqual,
  SnapshotOf,
  UseField,
  UseFormState,
  UseItems,
  UseValidator,
  ValidatorHandleLike,
} from "./field.js";
export { errorId, useFieldRef, useInputProps } from "./input.js";
export type {
  BaseInputProps,
  CheckboxInputOptions,
  CheckboxInputProps,
  EmptyOption,
  ErrorId,
  FieldRef,
  InputHandle,
  NumberInputOptions,
  NumberInputProps,
  RadioInputOptions,
  RadioInputProps,
  SelectOptions,
  SelectProps,
  TextInputOptions,
  TextInputProps,
  UseFieldRef,
  UseInputProps,
} from "./input.js";
export { Field, FormProvider, Items, useFormContext } from "./components.js";
export type {
  FieldComponent,
  FieldProps,
  FormProviderComponent,
  FormProviderProps,
  ItemsComponent,
  ItemsProps,
  UseFormContext,
} from "./components.js";
