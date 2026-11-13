import type { Option } from "@lunarhue/forms-example-order";
import type { Choice, FieldApi, FormError } from "@lunarhue/forms-react";
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
 * input's `aria-describedby` names, so the stylesheet can keep a line of
 * space for it and an error appearing doesn't move the rest of the form.
 * While it is empty it is hidden from screen readers.
 */
export function FieldErrors({ id, errors }: FieldErrorsProps) {
  return (
    <ul className="field-errors" id={id} aria-hidden={errors.length === 0 ? true : undefined}>
      {errors.map((error) => (
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
export function TextField({ field, label, type, autoComplete, inline }: TextFieldProps) {
  const badge = useRenderBadge();
  return (
    <div className="field">
      <div className="field-label">
        {inline ? null : <label htmlFor={field.id}>{label}</label>}
        <RenderBadge counter={badge} name={field.name} />
        {/* In the label row, so it appears and goes without moving the layout. */}
        {field.validating ? <span className="field-hint">Checking...</span> : null}
      </div>
      <input
        {...field.inputProps()}
        type={type ?? "text"}
        autoComplete={autoComplete}
        aria-label={inline ? label : undefined}
      />
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
export function NumberField({ field, label, step, inline }: NumberFieldProps) {
  const badge = useRenderBadge();
  return (
    <div className="field">
      <div className="field-label">
        {inline ? null : <label htmlFor={field.id}>{label}</label>}
        <RenderBadge counter={badge} name={field.name} />
      </div>
      <input
        {...field.inputProps({ kind: "number" })}
        step={step}
        aria-label={inline ? label : undefined}
      />
      <FieldErrors id={field.errorId} errors={field.shownErrors} />
    </div>
  );
}

// The option fields below are written with `Choice` where the option type
// goes. Each is registered once and works on any field of string options:
// on `delivery`, `options` takes delivery methods only, and on `country`,
// countries only. Inside the component `Choice` is a plain string, and the
// only values of it come from `options`, so the component writes nothing
// else to the field.

/** Props for `RadioGroupField`. */
export interface RadioGroupFieldProps {
  readonly field: FieldApi<Choice>;
  readonly label: string;
  readonly options: readonly Option<Choice>[];
}

/** A radio group. Each radio gets its own id from `inputProps`, so each label can point at it. */
export function RadioGroupField({ field, label, options }: RadioGroupFieldProps) {
  const badge = useRenderBadge();
  return (
    <div className="field" role="radiogroup" aria-labelledby={`${field.id}-label`}>
      <div className="field-label">
        <span id={`${field.id}-label`}>{label}</span>
        <RenderBadge counter={badge} name={field.name} />
      </div>
      <div className="option-group">
        {options.map((option) => {
          const input = field.inputProps({ kind: "radio", value: option.value });
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
export interface CheckboxGroupFieldProps {
  /** An array of option values. */
  readonly field: FieldApi<Choice[]>;
  readonly label: string;
  readonly options: readonly Option<Choice>[];
}

/** A checkbox group over an array field. Ticking a box adds its value to the array, unticking removes it. */
export function CheckboxGroupField({ field, label, options }: CheckboxGroupFieldProps) {
  const badge = useRenderBadge();
  return (
    <div className="field" role="group" aria-labelledby={`${field.id}-label`}>
      <div className="field-label">
        <span id={`${field.id}-label`}>{label}</span>
        <RenderBadge counter={badge} name={field.name} />
      </div>
      <div className="option-group">
        {options.map((option) => {
          const input = field.inputProps({ kind: "checkbox", value: option.value });
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
export interface SelectFieldProps {
  readonly field: FieldApi<Choice>;
  readonly label: string;
  readonly options: readonly Option<Choice>[];
}

/** A select with an empty first option, which writes `undefined`. */
export function SelectField({ field, label, options }: SelectFieldProps) {
  const badge = useRenderBadge();
  return (
    <div className="field">
      <div className="field-label">
        <label htmlFor={field.id}>{label}</label>
        <RenderBadge counter={badge} name={field.name} />
      </div>
      <select {...field.inputProps({ kind: "select" })}>
        <option value="">Choose one</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldErrors id={field.errorId} errors={field.shownErrors} />
    </div>
  );
}
