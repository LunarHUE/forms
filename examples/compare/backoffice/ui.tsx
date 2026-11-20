// Markup the back office's forms share in both builds. Each library's save
// bar and error summary read the form and pass the results in.
import type { ReactNode } from "react";

interface SaveBarViewProps {
  /** How many fields differ from the saved copy. */
  readonly count: number;
  readonly canUndo: boolean;
  readonly submitting: boolean;
  readonly onUndo: () => void;
  readonly onRefresh: () => void;
  readonly onDiscard: () => void;
}

export function SaveBarView({ count, canUndo, submitting, onUndo, onRefresh, onDiscard }: SaveBarViewProps) {
  return (
    <div className="save-bar">
      <span className="count">{count === 0 ? "No unsaved changes" : `${count} unsaved ${count === 1 ? "change" : "changes"}`}</span>
      <button type="button" disabled={!canUndo} onClick={onUndo}>
        Undo
      </button>
      <button type="button" onClick={onRefresh}>
        Refresh
      </button>
      <button type="button" disabled={count === 0} onClick={onDiscard}>
        Discard
      </button>
      <button type="submit" disabled={count === 0 || submitting}>
        {submitting ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

export interface Problem {
  /** The input's id, for the link. */
  readonly id: string;
  /** The field's dotted name. */
  readonly name: string;
  readonly messages: readonly string[];
}

/** Lists every field with errors, linked to its input. Renders nothing while the list is empty. */
export function ErrorSummaryView({ problems }: { readonly problems: readonly Problem[] }) {
  if (problems.length === 0) return null;
  return (
    <div className="summary" role="alert">
      <p>
        Fix {problems.length} {problems.length === 1 ? "field" : "fields"} before saving:
      </p>
      <ul>
        {problems.map((problem) => (
          <li key={problem.id}>
            <a href={`#${problem.id}`}>{problem.name}</a>: {problem.messages.join(" ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  const id = `${title.toLowerCase().replace(/\W+/g, "-")}-heading`;
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}
