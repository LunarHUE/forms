import { createComponent, createContext, untrack, useContext, type Element as SolidElement } from "solid-js";

/** A form object with its types erased, as context holds it. */
export type RuntimeForm = Readonly<Record<string, unknown>>;

/** What a `form.Form` provides: its form, and what the `form.Form` above it provides. */
interface FormNode {
  readonly form: RuntimeForm;
  readonly parent: FormNode | null;
}

/** The one context every `form.Form` provides. `null` is its default, so reading it with no provider above doesn't throw. */
const formContext = createContext<FormNode | null>(null);

/** The definition each form was made from. */
export const madeFrom = new WeakMap<RuntimeForm, object>();

/**
 * See `UseFormContext`. With a definition it walks up from the nearest
 * `form.Form` to the first form made from that definition. Throws a clear
 * error when there is none.
 */
export function useAnyForm(definition?: object): RuntimeForm {
  let node = useContext(formContext);
  if (definition !== undefined) {
    while (node !== null && madeFrom.get(node.form) !== definition) node = node.parent;
  }
  if (node === null) {
    throw new Error(
      definition === undefined
        ? "@lunarhue/forms-solid: useFormContext() found no form. Render it inside the form's `form.Form`."
        : "@lunarhue/forms-solid: useFormContext(definition) found no form made from that definition. It skips forms of other definitions. Render it inside the `form.Form` of a form made by `createForm(definition)`.",
    );
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
  return createComponent(formContext, {
    value: { form, parent: useContext(formContext) },
    get children() {
      const children = props.children;
      if (typeof children === "function") return untrack(() => children(form.formProps, form));
      return children;
    },
  });
}
