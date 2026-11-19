import { type FormStateSource, useFormState } from "@lunarhue/forms-react";
import type { ReactNode } from "react";

// Shared bits of the field-pieces POC pages. Not docs content.

/** Shows "5551234567" as "(555) 123-4567". */
export function formatPhone(value: string): string {
  if (value.length > 6) return `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`;
  if (value.length > 3) return `(${value.slice(0, 3)}) ${value.slice(3)}`;
  return value;
}

export const required = (message: string) => (value: unknown) =>
  value === "" || value === undefined || value === null || (Array.isArray(value) && value.length === 0) ? { message } : undefined;

/** Prints the last submit's result, which is the stored value. */
export function Submitted<I, R>({ form }: { readonly form: { readonly store: FormStateSource<I, R> } }) {
  const submission = useFormState(form, (snapshot) => snapshot.submission);
  const text = submission.status === "succeeded" ? JSON.stringify(submission.result) : submission.status;
  return (
    <output data-testid="submitted" className="mt-4 block font-mono text-sm">
      {text}
    </output>
  );
}

export function Frame({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}

export const inputClass = "h-9 w-full rounded border border-neutral-400 px-2 data-invalid:border-red-600";
export const labelClass = "text-sm font-medium";
export const errorClass = "text-sm text-red-600";
export const buttonClass = "h-9 w-fit rounded bg-neutral-900 px-4 text-white dark:bg-white dark:text-neutral-900";
