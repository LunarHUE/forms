// Presentational pieces both libraries render, so the two builds of an app
// differ only in how they wire the form. Nothing here knows about a form
// library: each side's field components pass in ids, errors and flags.
import type { ReactNode } from "react";

interface FieldShellProps {
  /** The input's id, which the label points at. */
  readonly id: string;
  /** The id of the error list, for the input's `aria-describedby`. */
  readonly errorId: string;
  readonly label: string;
  /** The messages to show now. */
  readonly errors: readonly string[];
  /** Marks the field as changed since it was loaded or saved. */
  readonly changed?: boolean | undefined;
  /** Shows "Checking..." while an async check runs. */
  readonly checking?: boolean | undefined;
  readonly children: ReactNode;
}

export function FieldShell({ id, errorId, label, errors, changed, checking, children }: FieldShellProps) {
  return (
    <div className="field" data-changed={changed === true ? "" : undefined}>
      <label htmlFor={id}>{label}</label>
      {children}
      {checking === true ? <span className="checking">Checking...</span> : null}
      <ErrorList id={errorId} errors={errors} />
    </div>
  );
}

interface CheckShellProps {
  readonly errorId: string;
  readonly errors: readonly string[];
  readonly changed?: boolean | undefined;
  /** The checkbox, rendered inside the label. */
  readonly children: ReactNode;
}

export function CheckShell({ errorId, errors, changed, children }: CheckShellProps) {
  return (
    <div className="field" data-changed={changed === true ? "" : undefined}>
      <label className="check">{children}</label>
      <ErrorList id={errorId} errors={errors} />
    </div>
  );
}

export function ErrorList({ id, errors }: { readonly id?: string; readonly errors: readonly string[] }) {
  return (
    <ul id={id} className="errors">
      {errors.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

export function Page({ title, lede, children }: { readonly title: string; readonly lede: string; readonly children: ReactNode }) {
  return (
    <main>
      <h1>{title}</h1>
      <p className="lede">{lede}</p>
      {children}
    </main>
  );
}
