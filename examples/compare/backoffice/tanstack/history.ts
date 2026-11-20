// Undo for a TanStack form, which has none. The field components and the
// line buttons record the old value before each user change. Undo writes it
// back. One stack per form, found by its id: field components see the core
// form object, while the form context hands out a copy of it.
import type { AnyFormApi } from "@tanstack/react-form";
import { useSyncExternalStore } from "react";

interface Step {
  readonly name: string;
  readonly value: unknown;
}

const limit = 100;

class UndoStack {
  #steps: Step[] = [];
  readonly #listeners = new Set<() => void>();

  get canUndo(): boolean {
    return this.#steps.length > 0;
  }

  /** Call before a user change, with the field's value before it. */
  record(name: string, value: unknown): void {
    this.#steps = [...this.#steps, { name, value }].slice(-limit);
    this.#notify();
  }

  undo(form: AnyFormApi): void {
    const step = this.#steps.at(-1);
    if (step === undefined) return;
    this.#steps = this.#steps.slice(0, -1);
    form.setFieldValue(step.name, step.value);
    this.#notify();
  }

  clear(): void {
    if (this.#steps.length === 0) return;
    this.#steps = [];
    this.#notify();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  #notify(): void {
    for (const listener of this.#listeners) listener();
  }
}

const stacks = new Map<string, UndoStack>();

/** The form's undo stack. */
export function undoStackOf(form: AnyFormApi): UndoStack {
  let stack = stacks.get(form.formId);
  if (stack === undefined) {
    stack = new UndoStack();
    stacks.set(form.formId, stack);
  }
  return stack;
}

/** True while the form has a change to undo. */
export function useCanUndo(form: AnyFormApi): boolean {
  const stack = undoStackOf(form);
  return useSyncExternalStore(stack.subscribe, () => stack.canUndo);
}
