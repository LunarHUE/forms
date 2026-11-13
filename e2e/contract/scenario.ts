import type { Submission } from "@lunarhue/forms-core";

/**
 * What the server HTML of a scenario must show before any script runs.
 * Every key is an input's label.
 */
export interface ServerView {
  /** Inputs and the value each must have. */
  readonly values?: Readonly<Record<string, string>>;
  /** Checkboxes that must be ticked. */
  readonly checked?: readonly string[];
  /** Inputs that must be disabled. */
  readonly disabled?: readonly string[];
  /** Inputs that must be read-only: `readonly` on a text input, `aria-readonly` on a checkbox. */
  readonly readOnly?: readonly string[];
  /** Labels that must not be on the page at all. */
  readonly absent?: readonly string[];
}

/** The part of a scenario every app and spec finds it by. */
export interface ScenarioInfo<I extends string> {
  readonly id: I;
  /** The path of its page, the same in every app. */
  readonly route: `/${I}`;
  /** The page's heading. */
  readonly title: string;
  /** What the server HTML must show. */
  readonly server: ServerView;
}

/** Starts a scenario's description. The id is kept as a literal type, so the scenario list can name each one. */
export function scenario<I extends string>(id: I, title: string, server: ServerView): ScenarioInfo<I> {
  return { id, route: `/${id}`, title, server };
}

/** Labels of a submit button, before and while a submit runs. */
export interface SubmitLabels {
  readonly idle: string;
  readonly busy: string;
}

/** The status line under a form: the result of the last submit when it succeeded, and nothing otherwise. */
export function statusText(submission: Submission<unknown>): string {
  return submission.status === "succeeded" && typeof submission.result === "string" ? submission.result : "";
}
