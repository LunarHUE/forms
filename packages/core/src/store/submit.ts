import type { ErrorMap } from "../errors.js";
import type { AnyFieldHandle } from "../handle.js";
import type { Path } from "../path.js";
import type { Submission } from "../snapshot.js";
import type { IntentArgs } from "../store.js";
import type { FormContext } from "./context.js";
import { errorList } from "./handles.js";
import type { Validation } from "./validation.js";

/** The store options submit reads. There are none until `onSubmit` arrives. */
// The type parameters are for the options `onSubmit` brings.
// oxlint-disable-next-line no-unused-vars
export interface SubmitOptions<V, E, I, R> {}

/** Submitting, form-wide user errors and finding the first invalid field. */
export interface Submit<E, I, R> {
  /** As `FormStore.submit`. */
  submit(...args: IntentArgs<I>): Promise<Submission<I, R>>;
  /** As `FormStore.handleSubmit`. */
  handleSubmit(event?: { preventDefault(): void }): Promise<void>;
  /** As `FormStore.setErrors`. */
  setErrors(errors: ErrorMap<E>): void;
  /** As `FormStore.firstInvalid`. */
  firstInvalid(): AnyFieldHandle<E> | undefined;
  /** Called when the whole form is reset, inside the reset's batch, to abort a running submit. */
  abort(): void;
}

/**
 * Makes submit. `submit` and `handleSubmit` are placeholders that throw.
 * `setErrors` and `firstInvalid` work.
 */
export function createSubmit<V, E, I, R>(
  context: FormContext<V, E, I, R>,
  // oxlint-disable-next-line typescript/no-generated-empty-object-type
  _options: SubmitOptions<V, E, I, R>,
  _validation: Validation<E>,
): Submit<E, I, R> {
  const { core } = context;
  return {
    submit() {
      throw new Error("not implemented");
    },
    handleSubmit() {
      throw new Error("not implemented");
    },
    setErrors(errors) {
      // Errors for one field from `form` and `fields` are joined, `form` first.
      const lists = new Map<string, { path: Path; errors: E[] }>();
      const add = (path: Path | undefined, more: readonly E[]) => {
        if (!path) return;
        const id = JSON.stringify(path);
        const entry = lists.get(id);
        if (entry) entry.errors.push(...more);
        else lists.set(id, { path, errors: [...more] });
      };
      if (errors.form !== undefined) add([], errorList(errors.form));
      for (const [name, entry] of Object.entries(errors.fields ?? {}))
        if (entry !== undefined) add(core.pathOf(name), errorList(entry));
      core.batch(() => {
        core.clearUserErrors([]);
        for (const { path, errors: list } of lists.values()) core.setUserErrors(path, list);
      });
    },
    firstInvalid() {
      const path = core.firstInvalid();
      return path && context.store().fieldAt(path);
    },
    abort() {},
  };
}
