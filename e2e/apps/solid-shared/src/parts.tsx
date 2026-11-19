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
  createField,
  createForms,
  defineField,
  type FieldApi,
  type FormError,
  inputProps,
  useFormContext,
} from "@lunarhue/forms-solid";
import { For, onSettled } from "solid-js";

interface RendersProps {
  readonly id: string;
}

/**
 * A render counter. Its ref runs once each time the element is made, which
 * is each time the component around it runs. On the server refs don't run,
 * so the server HTML has no count.
 */
export function Renders(props: RendersProps) {
  return (
    <output
      ref={(element) => {
        element.textContent = String(countRender(props.id));
      }}
      data-testid={testIds.renders(props.id)}
      aria-hidden="true"
    />
  );
}

interface ProbeProps {
  readonly store: AnyFormStore;
  readonly sources?: Readonly<Record<string, ProbeSource>>;
}

/** The state probe, started once the page has hydrated. */
export function Probe(props: ProbeProps) {
  let element: HTMLPreElement | undefined;
  onSettled(() => (element ? startProbe(element, props.store, props.sources) : undefined));
  return (
    <pre
      ref={(pre) => {
        element = pre;
      }}
      data-testid={testIds.probe}
    />
  );
}

interface ErrorListProps {
  readonly id?: string;
  readonly label?: string;
  readonly errors: readonly FormError[];
}

export function ErrorList(props: ErrorListProps) {
  return (
    <ul class="errors" id={props.id} aria-label={props.label}>
      <For each={props.errors}>{(error) => <li>{error.message}</li>}</For>
    </ul>
  );
}

interface FieldProps<V> {
  readonly field: FieldApi<V>;
  readonly label: string;
}

function TextField(props: FieldProps<string>) {
  return (
    <div class="field">
      <label for={props.field.id}>{props.label}</label>
      <input {...inputProps(props.field)} />
      <span class="checking" hidden={!props.field.validating}>
        Checking...
      </span>
      <ErrorList id={props.field.errorId} errors={props.field.shownErrors} />
      <Renders id={props.field.name} />
    </div>
  );
}

function NumberField(props: FieldProps<number>) {
  return (
    <div class="field">
      <label for={props.field.id}>{props.label}</label>
      <input {...inputProps(props.field, { kind: "number" })} />
      <ErrorList id={props.field.errorId} errors={props.field.shownErrors} />
      <Renders id={props.field.name} />
    </div>
  );
}

function Checkbox(props: FieldProps<boolean>) {
  return (
    <div class="field">
      <label>
        <input {...inputProps(props.field, { kind: "checkbox" })} />
        {props.label}
      </label>
      <ErrorList id={props.field.errorId} errors={props.field.shownErrors} />
      <Renders id={props.field.name} />
    </div>
  );
}

/** A phone input. `PhoneField` below adds the mask that formats the digits the store holds. */
function PhoneInput(props: FieldProps<string>) {
  return (
    <div class="field">
      <label for={props.field.id}>{props.label}</label>
      <input {...inputProps(props.field, { type: "tel" })} />
      <ErrorList id={props.field.errorId} errors={props.field.shownErrors} />
      <Renders id={props.field.name} />
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
export function SubmitButton(props: SubmitLabels) {
  const form = useFormContext();
  return (
    <button type="submit" disabled={form.state.submitting}>
      {form.state.submitting ? props.busy : props.idle}
    </button>
  );
}

/** The result of the last submit. */
export function Status() {
  const form = useFormContext();
  return <p role="status">{statusText(form.state.submission)}</p>;
}

interface FormErrorsProps {
  readonly label: string;
}

/** Errors on the form as a whole, which core keeps on the root field. */
export function FormErrors(props: FormErrorsProps) {
  const form = useFormContext(forms);
  const root = createField(form.root);
  return <ErrorList label={props.label} errors={root.shownErrors} />;
}
