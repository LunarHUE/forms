import type { Option } from "@lunarhue/forms-example-order";
import type {
  CheckboxGroupInputProps,
  FieldApi,
  FormError,
  RadioInputProps,
  SelectProps,
} from "@lunarhue/forms-react";
import { RenderBadge, useRenderBadge } from "./badge.js";

// The field components. Every one takes a field object as its `field` prop,
// which carries the snapshot (`value`, `shownErrors`, `validating` and the
// rest), the commands and `inputProps`. A field object is new whenever the
// field's snapshot changes, so these components re-render exactly when their
// own field does.

/** Props for `FieldErrors`. */
export interface FieldErrorsProps {
  /** The field's `errorId`. Input props point `aria-describedby` at it while errors show. */
  readonly id: string;
  /** The errors to list: the field's `shownErrors`. */
  readonly errors: readonly FormError[];
}

/**
 * The error list under a field. It is always rendered, with the id the
 * input's `aria-describedby` names, and takes no space while it is empty.
 */
export function FieldErrors(props: FieldErrorsProps) {
  return (
    <ul className="field-errors" id={props.id}>
      {props.errors.map((error) => (
        <li key={error.message}>{error.message}</li>
      ))}
    </ul>
  );
}

/** Props for `TextField`. */
export interface TextFieldProps {
  /** The field. Registered components get it from the bound component. */
  readonly field: FieldApi<string>;
  readonly label: string;
  readonly type?: "text" | "email";
  readonly autoComplete?: string;
  /** Leaves the label out of view and puts it on the input as `aria-label`, for table cells. */
  readonly inline?: boolean;
}

/**
 * A text input with its label, a "checking" hint while an async validator
 * runs, and its errors. It is registered with `createForms`, so every form
 * and scope has it bound as `form.TextField name="customer.name"`.
 */
export function TextField(props: TextFieldProps) {
  const { field } = props;
  const badge = useRenderBadge();
  return (
    <div className="field">
      <div className="field-label">
        {props.inline ? null : <label htmlFor={field.id}>{props.label}</label>}
        <RenderBadge counter={badge} name={field.name} />
      </div>
      <input
        {...field.inputProps()}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        aria-label={props.inline ? props.label : undefined}
      />
      {field.validating ? <span className="field-hint">Checking...</span> : null}
      <FieldErrors id={field.errorId} errors={field.shownErrors} />
    </div>
  );
}

/** Props for `NumberField`. */
export interface NumberFieldProps {
  /** `FieldApi<number>` fits the schema's number fields, which hold `number | undefined` until filled in. */
  readonly field: FieldApi<number>;
  readonly label: string;
  readonly step?: number;
  readonly inline?: boolean;
}

/**
 * A number input. `inputProps({ kind: "number" })` writes `valueAsNumber`,
 * or `undefined` when the input is empty, and keeps text such as `1.` while
 * the user is still typing. Registered, like `TextField`.
 */
export function NumberField(props: NumberFieldProps) {
  const { field } = props;
  const badge = useRenderBadge();
  return (
    <div className="field">
      <div className="field-label">
        {props.inline ? null : <label htmlFor={field.id}>{props.label}</label>}
        <RenderBadge counter={badge} name={field.name} />
      </div>
      <input
        {...field.inputProps({ kind: "number" })}
        step={props.step}
        aria-label={props.inline ? props.label : undefined}
      />
      <FieldErrors id={field.errorId} errors={field.shownErrors} />
    </div>
  );
}

// The option fields below are generic over their option values, so a radio
// group for the delivery method only accepts delivery methods. A generic
// component can't be registered with `createForms`: registration reads the
// props with `T` at its constraint, `string`, and a `"GB" | "FR"` field
// doesn't fit a component whose `setValue` takes any string. So the form
// renders them through `form.Field`, which hands its children the field
// object, and TypeScript infers `T` at each use.
//
// They also can't call `field.inputProps` themselves. Its options are a
// conditional type on the field's value type, which TypeScript leaves
// unresolved while `T` is a type parameter, so no options object type-checks
// inside a generic component. The caller, where `T` is concrete, passes a
// function that makes one option's input props instead.

/** The members of a field object an option field reads. Every field object fits. */
export interface OptionFieldApi {
  readonly id: string;
  readonly name: string;
  readonly errorId: string;
  readonly shownErrors: readonly FormError[];
}

/** Props for `RadioGroupField`. */
export interface RadioGroupFieldProps<T extends string> {
  /** The field object `form.Field` passes its children. */
  readonly field: OptionFieldApi;
  readonly label: string;
  readonly options: readonly Option<T>[];
  /** One radio's props: `(value) => field.inputProps({ kind: "radio", value })`. */
  readonly radio: (value: T) => RadioInputProps;
}

/** A radio group. Each radio gets its own id from `inputProps`, so each label can point at it. */
export function RadioGroupField<T extends string>(props: RadioGroupFieldProps<T>) {
  const { field } = props;
  const badge = useRenderBadge();
  return (
    <div className="field" role="radiogroup" aria-labelledby={`${field.id}-label`}>
      <div className="field-label">
        <span id={`${field.id}-label`}>{props.label}</span>
        <RenderBadge counter={badge} name={field.name} />
      </div>
      <div className="option-group">
        {props.options.map((option) => {
          const input = props.radio(option.value);
          return (
            <label key={option.value} className="option" htmlFor={input.id}>
              <input {...input} />
              {option.label}
            </label>
          );
        })}
      </div>
      <FieldErrors id={field.errorId} errors={field.shownErrors} />
    </div>
  );
}

/** Props for `CheckboxGroupField`. */
export interface CheckboxGroupFieldProps<T extends string> {
  /** The field object of an array of option values. */
  readonly field: OptionFieldApi;
  readonly label: string;
  readonly options: readonly Option<T>[];
  /** One checkbox's props: `(value) => field.inputProps({ kind: "checkbox", value })`. */
  readonly checkbox: (value: T) => CheckboxGroupInputProps;
}

/** A checkbox group over an array field. Ticking a box adds its value to the array, unticking removes it. */
export function CheckboxGroupField<T extends string>(props: CheckboxGroupFieldProps<T>) {
  const { field } = props;
  const badge = useRenderBadge();
  return (
    <div className="field" role="group" aria-labelledby={`${field.id}-label`}>
      <div className="field-label">
        <span id={`${field.id}-label`}>{props.label}</span>
        <RenderBadge counter={badge} name={field.name} />
      </div>
      <div className="option-group">
        {props.options.map((option) => {
          const input = props.checkbox(option.value);
          return (
            <label key={option.value} className="option" htmlFor={input.id}>
              <input {...input} />
              {option.label}
            </label>
          );
        })}
      </div>
      <FieldErrors id={field.errorId} errors={field.shownErrors} />
    </div>
  );
}

/** Props for `SelectField`. */
export interface SelectFieldProps<T extends string> {
  readonly field: OptionFieldApi;
  readonly label: string;
  readonly options: readonly Option<T>[];
  /** The select's props: `field.inputProps({ kind: "select" })`. The empty option writes `undefined`. */
  readonly select: SelectProps;
}

/** A select with an empty first option, which writes `undefined`. */
export function SelectField<T extends string>(props: SelectFieldProps<T>) {
  const { field } = props;
  const badge = useRenderBadge();
  return (
    <div className="field">
      <div className="field-label">
        <label htmlFor={field.id}>{props.label}</label>
        <RenderBadge counter={badge} name={field.name} />
      </div>
      <select {...props.select}>
        <option value="">Choose one</option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldErrors id={field.errorId} errors={field.shownErrors} />
    </div>
  );
}
