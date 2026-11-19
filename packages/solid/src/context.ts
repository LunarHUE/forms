import { isRenderFunction, providerOf } from "#solid";
import { createComponent, createContext, untrack, useContext } from "solid-js";
import type { SolidElement } from "./element.js";
import { problem } from "./problem.js";

/** A form object with its types erased, as context holds it. */
export type RuntimeForm = Readonly<Record<string, unknown>>;

/** What a `form.Form` provides: its form, and what the `form.Form` above it provides. */
interface FormNode {
  readonly form: RuntimeForm;
  readonly parent: FormNode | null;
}

/** The one context every `form.Form` provides. `null` is its default, so reading it with no provider above doesn't throw. */
const formContext = createContext<FormNode | null>(null);
const FormProvider = providerOf(formContext);

/** The definition each form was made from. */
export const madeFrom = new WeakMap<RuntimeForm, object>();

/** The `createForms` result each form was defined by. */
export const madeBy = new WeakMap<RuntimeForm, object>();

/**
 * See `useFormContext`. With a definition, or a `createForms` result, it
 * walks up from the nearest `form.Form` to the first form made from it.
 * Throws a clear error when there is none.
 */
export function useAnyForm(definition?: object): RuntimeForm {
  let node = useContext(formContext);
  if (definition !== undefined) {
    while (node !== null && madeFrom.get(node.form) !== definition && madeBy.get(node.form) !== definition) node = node.parent;
  }
  if (node === null) {
    throw new Error(problem(definition === undefined ? "context:form" : "define" in definition ? "context:forms" : "context:definition"));
  }
  return node.form;
}

/** The children `form.Form` takes: a function of the form element props and the form, or plain children. */
export type FormChildren = ((formProps: unknown, form: RuntimeForm) => SolidElement) | SolidElement;

/**
 * `form.Form`: provides `form`, linked to the form above, and renders no
 * element of its own. A function child gets the form element props and the
 * form. Plain children render as they are.
 */
export function provideForm(form: RuntimeForm, props: { readonly children: FormChildren }): SolidElement {
  return createComponent(FormProvider, {
    value: { form, parent: useContext(formContext) },
    get children() {
      const children = props.children;
      if (isRenderFunction(children)) return untrack(() => children(form.formProps, form));
      return children;
    },
  });
}
