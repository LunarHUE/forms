// The back office's form hook: field components, the masked inputs, and the
// save bar and error summary as form components, so every form gets them.
import { type AnyFormApi, createFormHook, createFormHookContexts, useStore } from "@tanstack/react-form";
import { type HTMLAttributes, type ReactNode, useLayoutEffect, useRef } from "react";
import { CheckShell, FieldShell } from "../../shared/ui.tsx";
import { cleanMoney, digitsOnly, formatMoney, formatPhone, formatTaxId } from "../format.ts";
import { ErrorSummaryView, SaveBarView } from "../ui.tsx";
import { undoStackOf, useCanUndo } from "./history.ts";
import { changedNames } from "./values.ts";

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();

/**
 * The input id for a field. The error summary links to inputs by name, so
 * the id comes from the form's id and the field's name, not from `useId`.
 */
export const fieldId = (form: AnyFormApi, name: string): string => `${form.formId}-${name}`;

/** Schema issues arrive as objects, function validators' errors as strings. */
export function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message;
  return String(error);
}

/**
 * What every field component needs: ids, the errors to show, the changed
 * mark, and a change handler that records the old value for Undo. Errors
 * wait for a blur or a submit.
 */
function useFieldView<V>() {
  const field = useFieldContext<V>();
  const id = fieldId(field.form, field.name);
  const submitted = useStore(field.form.store, (state) => state.submissionAttempts > 0);
  const { isBlurred, errors, isDefaultValue } = field.state.meta;
  const shown = isBlurred || submitted ? [...new Set(errors.map(messageOf))] : [];
  return {
    field,
    id,
    errorId: `${id}-errors`,
    errors: shown,
    changed: !isDefaultValue,
    change: (value: V) => {
      undoStackOf(field.form).record(field.name, field.state.value);
      field.handleChange(value);
    },
    aria: {
      "aria-invalid": shown.length > 0 ? true : undefined,
      "aria-describedby": shown.length > 0 ? `${id}-errors` : undefined,
    },
  };
}

function TextField({ label }: { readonly label: string }) {
  const view = useFieldView<string>();
  return (
    <FieldShell id={view.id} errorId={view.errorId} label={label} errors={view.errors} changed={view.changed}>
      <input
        id={view.id}
        name={view.field.name}
        value={view.field.state.value}
        onChange={(event) => view.change(event.target.value)}
        onBlur={view.field.handleBlur}
        {...view.aria}
      />
    </FieldShell>
  );
}

function TextArea({ label }: { readonly label: string }) {
  const view = useFieldView<string>();
  return (
    <FieldShell id={view.id} errorId={view.errorId} label={label} errors={view.errors} changed={view.changed}>
      <textarea
        id={view.id}
        rows={3}
        name={view.field.name}
        value={view.field.state.value}
        onChange={(event) => view.change(event.target.value)}
        onBlur={view.field.handleBlur}
        {...view.aria}
      />
    </FieldShell>
  );
}

/** A select over the field's options. The field context can't type them, so they are strings. */
function Select({ label, options }: { readonly label: string; readonly options: readonly string[] }) {
  const view = useFieldView<string>();
  return (
    <FieldShell id={view.id} errorId={view.errorId} label={label} errors={view.errors} changed={view.changed}>
      <select
        id={view.id}
        name={view.field.name}
        value={view.field.state.value}
        onChange={(event) => view.change(event.target.value)}
        onBlur={view.field.handleBlur}
        {...view.aria}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function Checkbox({ label }: { readonly label: string }) {
  const view = useFieldView<boolean>();
  return (
    <CheckShell errorId={view.errorId} errors={view.errors} changed={view.changed}>
      <input
        id={view.id}
        type="checkbox"
        name={view.field.name}
        checked={view.field.state.value}
        onChange={(event) => view.change(event.target.checked)}
        onBlur={view.field.handleBlur}
        {...view.aria}
      />
      {label}
    </CheckShell>
  );
}

/** Where the caret goes in `text` so that `count` clean characters sit before it. */
function caretAfter(text: string, clean: (text: string) => string, count: number): number {
  for (let index = 0; index <= text.length; index++) {
    if (clean(text.slice(0, index)).length >= count) return index;
  }
  return text.length;
}

interface MaskProps {
  readonly label: string;
  readonly inputMode: HTMLAttributes<HTMLInputElement>["inputMode"];
}

/**
 * An input that stores `clean(text)` and shows `display(value)`. React puts
 * the caret at the end when the shown text changes length, so the caret is
 * put back after the same number of clean characters as before the edit.
 */
function MaskedInput({ label, inputMode, clean, display }: MaskProps & { readonly clean: (text: string) => string; readonly display: (value: string) => string }) {
  const view = useFieldView<string>();
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const text = display(view.field.state.value);

  useLayoutEffect(() => {
    if (caret.current === null || input.current === null) return;
    const position = caretAfter(text, clean, caret.current);
    caret.current = null;
    input.current.setSelectionRange(position, position);
  });

  return (
    <FieldShell id={view.id} errorId={view.errorId} label={label} errors={view.errors} changed={view.changed}>
      <input
        ref={input}
        id={view.id}
        inputMode={inputMode}
        name={view.field.name}
        value={text}
        onChange={(event) => {
          const typed = event.target.value;
          caret.current = clean(typed.slice(0, event.target.selectionStart ?? typed.length)).length;
          view.change(clean(typed));
        }}
        onBlur={view.field.handleBlur}
        {...view.aria}
      />
    </FieldShell>
  );
}

const cleanPhone = digitsOnly(10);
const cleanTaxId = digitsOnly(9);
const cleanQuantity = digitsOnly(4);
const shownAsIs = (value: string) => value;

const PhoneField = (props: MaskProps) => <MaskedInput {...props} clean={cleanPhone} display={formatPhone} />;
const TaxIdField = (props: MaskProps) => <MaskedInput {...props} clean={cleanTaxId} display={formatTaxId} />;
const MoneyField = (props: MaskProps) => <MaskedInput {...props} clean={cleanMoney} display={formatMoney} />;
const QuantityField = (props: MaskProps) => <MaskedInput {...props} clean={cleanQuantity} display={shownAsIs} />;

interface SaveBarProps {
  /** The form's current default values, the copy the count compares against. */
  readonly defaults: unknown;
  /** Fetches the server's copy and makes it the defaults. */
  readonly refresh: () => Promise<void>;
}

/**
 * The change count, undo, refresh, discard and save. The form context hands
 * out a copy of the form whose `options` don't follow `reset(values)`, so
 * the defaults come in as a prop.
 */
function SaveBar({ defaults, refresh }: SaveBarProps) {
  const form = useFormContext();
  const count = useStore(form.store, (state) => changedNames(state.values, defaults).length);
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const canUndo = useCanUndo(form);
  return (
    <SaveBarView
      count={count}
      canUndo={canUndo}
      submitting={submitting}
      onUndo={() => undoStackOf(form).undo(form)}
      onRefresh={() => void refresh()}
      onDiscard={() => {
        form.reset();
        undoStackOf(form).clear();
      }}
    />
  );
}

/** The form element, wired to submit, with the status line under it. */
function RecordForm({ status, children }: { readonly status: string; readonly children: ReactNode }) {
  const form = useFormContext();
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      {children}
      <p role="status">{status}</p>
    </form>
  );
}

/** Every field with errors, once the user has tried to save. */
function ErrorSummary() {
  const form = useFormContext();
  const problems = useStore(form.store, (state) =>
    state.submissionAttempts === 0
      ? []
      : Object.entries(state.fieldMeta).flatMap(([name, meta]) => {
          // The context's form is untyped, so its meta is too.
          const errors: readonly unknown[] = typeof meta === "object" && meta !== null && "errors" in meta && Array.isArray(meta.errors) ? meta.errors : [];
          return errors.length === 0 ? [] : [{ id: fieldId(form, name), name, messages: [...new Set(errors.map(messageOf))] }];
        }),
  );
  return <ErrorSummaryView problems={problems} />;
}

export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, TextArea, Select, Checkbox, PhoneField, TaxIdField, MoneyField, QuantityField },
  formComponents: { RecordForm, SaveBar, ErrorSummary },
});
