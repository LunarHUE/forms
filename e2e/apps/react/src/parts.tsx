import {
  countRender,
  phoneMask,
  type ProbeSource,
  sharedPlugins,
  startProbe,
  statusText,
  type SubmitLabels,
  testIds,
} from "@lunarhue/forms-e2e/contract";
import {
  type AnyFormStore,
  createForms,
  defineField,
  type FieldApi,
  type FormError,
  inputProps,
  useField,
  useFormContext,
  useFormState,
} from "@lunarhue/forms-react";
import { useEffect, useRef } from "react";

interface RendersProps {
  readonly id: string;
}

/**
 * A render counter. It has no memo, so it renders each time its parent does,
 * and its effect writes the new count after each commit. React never sees the
 * text, so showing it causes no render of its own.
 */
export function Renders({ id }: RendersProps) {
  const counter = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    if (counter.current) counter.current.textContent = String(countRender(id));
  });
  return <output ref={counter} data-testid={testIds.renders(id)} aria-hidden="true" />;
}

interface ProbeProps {
  readonly store: AnyFormStore;
  readonly sources?: Readonly<Record<string, ProbeSource>>;
}

/** The state probe, started once the page has hydrated. */
export function Probe({ store, sources }: ProbeProps) {
  const element = useRef<HTMLPreElement>(null);
  useEffect(() => (element.current ? startProbe(element.current, store, sources) : undefined), [store, sources]);
  return <pre ref={element} data-testid={testIds.probe} />;
}

interface ErrorListProps {
  readonly id?: string;
  readonly label?: string;
  readonly errors: readonly FormError[];
}

export function ErrorList({ id, label, errors }: ErrorListProps) {
  return (
    <ul className="errors" id={id} aria-label={label}>
      {errors.map((error) => (
        <li key={error.message}>{error.message}</li>
      ))}
    </ul>
  );
}

interface FieldProps<V> {
  readonly field: FieldApi<V>;
  readonly label: string;
}

function TextField({ field, label }: FieldProps<string>) {
  return (
    <div className="field">
      <label htmlFor={field.id}>{label}</label>
      <input {...inputProps(field)} />
      <span className="checking" hidden={!field.validating}>
        Checking...
      </span>
      <ErrorList id={field.errorId} errors={field.shownErrors} />
      <Renders id={field.name} />
    </div>
  );
}

function NumberField({ field, label }: FieldProps<number>) {
  return (
    <div className="field">
      <label htmlFor={field.id}>{label}</label>
      <input {...inputProps(field, { kind: "number" })} />
      <ErrorList id={field.errorId} errors={field.shownErrors} />
      <Renders id={field.name} />
    </div>
  );
}

function Checkbox({ field, label }: FieldProps<boolean>) {
  return (
    <div className="field">
      <label>
        <input {...inputProps(field, { kind: "checkbox" })} />
        {label}
      </label>
      <ErrorList id={field.errorId} errors={field.shownErrors} />
      <Renders id={field.name} />
    </div>
  );
}

/** A phone input. `PhoneField` below adds the mask that formats the digits the store holds. */
function PhoneInput({ field, label }: FieldProps<string>) {
  return (
    <div className="field">
      <label htmlFor={field.id}>{label}</label>
      <input {...inputProps(field, { type: "tel" })} />
      <ErrorList id={field.errorId} errors={field.shownErrors} />
      <Renders id={field.name} />
    </div>
  );
}

const PhoneField = defineField(PhoneInput, phoneMask);

/** The app's one `createForms`. Every page defines its form with it. */
export const forms = createForms({
  plugins: sharedPlugins,
  fields: { TextField, NumberField, Checkbox, PhoneField },
});

/** The submit button, busy and disabled while a submit runs. */
export function SubmitButton({ idle, busy }: SubmitLabels) {
  const form = useFormContext();
  const submitting = useFormState(form, (state) => state.submitting);
  return (
    <button type="submit" disabled={submitting}>
      {submitting ? busy : idle}
    </button>
  );
}

/** The result of the last submit. */
export function Status() {
  const form = useFormContext();
  const submission = useFormState(form, (state) => state.submission);
  return <p role="status">{statusText(submission)}</p>;
}

interface FormErrorsProps {
  readonly label: string;
}

/** Errors on the form as a whole, which core keeps on the root field. */
export function FormErrors({ label }: FormErrorsProps) {
  const form = useFormContext(forms);
  const errors = useField(form.root, (snapshot) => snapshot.shownErrors);
  return <ErrorList label={label} errors={errors} />;
}
